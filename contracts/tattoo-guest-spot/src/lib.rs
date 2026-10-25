#![no_std]
use soroban_poseidon::poseidon_hash;
use soroban_sdk::{
    bytesn, contract, contractevent, contractimpl, contracttype, crypto::bn254::Bn254Fr,
    symbol_short, vec, Address, Env, String, Symbol, Vec, U256,
};

mod error;

use error::Error;

/// `spot_id` of a booking made from proposed dates, not from a published spot
pub const NO_SPOT: u32 = 0;

/// Reviews an artist needs before unlocking studio + home swaps
pub const HOME_SWAP_MIN_REVIEWS: u32 = 3;
/// Minimum average score (1-5) to unlock studio + home swaps
pub const HOME_SWAP_MIN_AVG: u32 = 4;

// Keep data alive for ~30 days on testnet (5s ledgers)
const TTL_THRESHOLD: u32 = 17_280 * 7;
const TTL_EXTEND_TO: u32 = 17_280 * 30;

const STUDIO: Symbol = symbol_short!("studio");
const STUDIO_HOME: Symbol = symbol_short!("home");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Artist(Address),
    Artists,
    Spot(u32),
    SpotCount,
    Booking(u32),
    BookingCount,
    ArtistBookings(Address),
    Reviews(Address),
    Invite(U256),
    Likes(Address),
    /// Conversation between two artists, addresses in ascending order
    Chat(Address, Address),
}

/// Messages kept per conversation (older ones are dropped)
pub const CHAT_MAX_MESSAGES: u32 = 50;
pub const CHAT_MAX_LEN: u32 = 280;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Message {
    pub from: Address,
    pub text: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Artist {
    pub address: Address,
    pub name: String,
    pub city: String,
    pub instagram: String,
    pub review_count: u32,
    pub score_sum: u32,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SpotStatus {
    Open = 0,
    Booked = 1,
    Done = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spot {
    pub id: u32,
    pub host: Address,
    pub city: String,
    /// "studio" or "home" (studio + home, only for trusted artists)
    pub kind: Symbol,
    /// Unix timestamps (seconds)
    pub start: u64,
    pub end: u64,
    /// Furniture and supplies the studio offers, e.g. camilla, tinta_negra, second_skin
    pub amenities: Vec<Symbol>,
    pub status: SpotStatus,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BookingStatus {
    /// New dates proposed by the guest, waiting for the host
    Pending = 0,
    Confirmed = 1,
    Completed = 2,
    Declined = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Booking {
    pub id: u32,
    pub spot_id: u32,
    pub host: Address,
    pub guest: Address,
    /// Unix timestamps (seconds) of the stay
    pub start: u64,
    pub end: u64,
    pub status: BookingStatus,
    /// Each side shares a "guest artist" post on social media before the stay
    pub host_promo_sent: bool,
    pub guest_promo_sent: bool,
    pub host_reviewed: bool,
    pub guest_reviewed: bool,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReviewerRole {
    /// Written by the host about the guest artist
    Host = 0,
    /// Written by the guest artist about the host
    Guest = 1,
    /// Written by a tattoo client through a one-time QR invite
    Client = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub from: Address,
    pub role: ReviewerRole,
    pub score: u32,
    pub tags: Vec<Symbol>,
    pub comment: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invite {
    pub artist: Address,
    pub used: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reputation {
    pub review_count: u32,
    /// Average score times 100 (e.g. 467 = 4.67)
    pub average_x100: u32,
    /// Same threshold as home swaps: "establecidx" vs "nuevx"
    pub home_swap_unlocked: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpotPublished {
    #[topic]
    pub host: Address,
    pub spot_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpotBooked {
    #[topic]
    pub guest: Address,
    pub booking_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewLeft {
    #[topic]
    pub artist: Address,
    pub role: ReviewerRole,
    pub score: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Matched {
    #[topic]
    pub a: Address,
    #[topic]
    pub b: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HomeSwapUnlocked {
    #[topic]
    pub artist: Address,
}

#[contract]
pub struct TattooGuestSpot;

#[contractimpl]
impl TattooGuestSpot {
    // ----- Artists -----

    /// Create your artist profile
    pub fn register_artist(
        env: &Env,
        artist: Address,
        name: String,
        city: String,
        instagram: String,
    ) -> Result<(), Error> {
        artist.require_auth();
        let key = DataKey::Artist(artist.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyRegistered);
        }
        let profile = Artist {
            address: artist.clone(),
            name,
            city,
            instagram,
            review_count: 0,
            score_sum: 0,
        };
        Self::save(env, &key, &profile);
        let mut artists = Self::artists(env);
        artists.push_back(artist);
        Self::save(env, &DataKey::Artists, &artists);
        Ok(())
    }

    pub fn get_artist(env: &Env, artist: Address) -> Option<Artist> {
        env.storage().persistent().get(&DataKey::Artist(artist))
    }

    /// Every registered artist
    pub fn list_artists(env: &Env) -> Vec<Artist> {
        let mut out = Vec::new(env);
        for a in Self::artists(env).iter() {
            if let Some(p) = Self::get_artist(env, a) {
                out.push_back(p);
            }
        }
        out
    }

    pub fn get_reputation(env: &Env, artist: Address) -> Result<Reputation, Error> {
        let p = Self::get_artist(env, artist).ok_or(Error::NotAnArtist)?;
        Ok(Self::reputation_of(&p))
    }

    pub fn list_reviews(env: &Env, artist: Address) -> Vec<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::Reviews(artist))
            .unwrap_or(Vec::new(env))
    }

    // ----- Spots and stays -----

    /// Offer your studio (or studio + home) as a guest spot between two dates
    pub fn publish_spot(
        env: &Env,
        host: Address,
        city: String,
        start: u64,
        end: u64,
        include_home: bool,
        amenities: Vec<Symbol>,
    ) -> Result<u32, Error> {
        host.require_auth();
        let profile = Self::get_artist(env, host.clone()).ok_or(Error::NotAnArtist)?;
        if end <= start {
            return Err(Error::InvalidDates);
        }
        if include_home && !Self::reputation_of(&profile).home_swap_unlocked {
            return Err(Error::NotTrustedEnough);
        }
        let id = Self::next_id(env, &DataKey::SpotCount);
        let spot = Spot {
            id,
            host: host.clone(),
            city,
            kind: if include_home { STUDIO_HOME } else { STUDIO },
            start,
            end,
            amenities,
            status: SpotStatus::Open,
        };
        Self::save(env, &DataKey::Spot(id), &spot);
        SpotPublished { host, spot_id: id }.publish(env);
        Ok(id)
    }

    pub fn get_spot(env: &Env, spot_id: u32) -> Option<Spot> {
        env.storage().persistent().get(&DataKey::Spot(spot_id))
    }

    /// Every spot ever published, newest first
    pub fn list_spots(env: &Env) -> Vec<Spot> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::SpotCount)
            .unwrap_or(0);
        let mut out = Vec::new(env);
        for id in (1..=count).rev() {
            if let Some(s) = Self::get_spot(env, id) {
                out.push_back(s);
            }
        }
        out
    }

    /// Take dates the host already published. They are confirmed right away.
    pub fn book_spot(env: &Env, guest: Address, spot_id: u32) -> Result<u32, Error> {
        guest.require_auth();
        let guest_profile = Self::get_artist(env, guest.clone()).ok_or(Error::NotAnArtist)?;
        let mut spot = Self::get_spot(env, spot_id).ok_or(Error::SpotNotFound)?;
        if spot.status != SpotStatus::Open {
            return Err(Error::SpotNotAvailable);
        }
        if spot.host == guest {
            return Err(Error::CannotBookOwnSpot);
        }
        if spot.kind == STUDIO_HOME && !Self::reputation_of(&guest_profile).home_swap_unlocked {
            return Err(Error::NotTrustedEnough);
        }
        spot.status = SpotStatus::Booked;
        Self::save(env, &DataKey::Spot(spot_id), &spot);
        Ok(Self::new_booking(
            env,
            spot_id,
            spot.host,
            guest,
            spot.start,
            spot.end,
            BookingStatus::Confirmed,
        ))
    }

    /// Propose new dates at a host's studio. The host reviews them and
    /// accepts (`confirm_booking`) or declines (`decline_booking`).
    pub fn propose_dates(
        env: &Env,
        guest: Address,
        host: Address,
        start: u64,
        end: u64,
    ) -> Result<u32, Error> {
        guest.require_auth();
        Self::get_artist(env, guest.clone()).ok_or(Error::NotAnArtist)?;
        Self::get_artist(env, host.clone()).ok_or(Error::NotAnArtist)?;
        if host == guest {
            return Err(Error::CannotBookOwnSpot);
        }
        if end <= start {
            return Err(Error::InvalidDates);
        }
        Ok(Self::new_booking(
            env,
            NO_SPOT,
            host,
            guest,
            start,
            end,
            BookingStatus::Pending,
        ))
    }

    /// The host accepts the proposed dates
    pub fn confirm_booking(env: &Env, host: Address, booking_id: u32) -> Result<(), Error> {
        host.require_auth();
        let mut booking = Self::host_booking(env, &host, booking_id)?;
        if booking.status != BookingStatus::Pending {
            return Err(Error::WrongBookingStatus);
        }
        booking.status = BookingStatus::Confirmed;
        Self::save(env, &DataKey::Booking(booking_id), &booking);
        Ok(())
    }

    /// The host declines the dates and the spot reopens
    pub fn decline_booking(env: &Env, host: Address, booking_id: u32) -> Result<(), Error> {
        host.require_auth();
        let mut booking = Self::host_booking(env, &host, booking_id)?;
        if booking.status != BookingStatus::Pending {
            return Err(Error::WrongBookingStatus);
        }
        booking.status = BookingStatus::Declined;
        Self::save(env, &DataKey::Booking(booking_id), &booking);
        if let Some(mut spot) = Self::get_spot(env, booking.spot_id) {
            spot.status = SpotStatus::Open;
            Self::save(env, &DataKey::Spot(spot.id), &spot);
        }
        Ok(())
    }

    /// Host or guest marks their "guest artist" social media post as sent
    pub fn mark_promo_sent(env: &Env, artist: Address, booking_id: u32) -> Result<(), Error> {
        artist.require_auth();
        let mut booking = Self::get_booking(env, booking_id).ok_or(Error::BookingNotFound)?;
        if artist == booking.host {
            booking.host_promo_sent = true;
        } else if artist == booking.guest {
            booking.guest_promo_sent = true;
        } else {
            return Err(Error::NotPartOfBooking);
        }
        Self::save(env, &DataKey::Booking(booking_id), &booking);
        Ok(())
    }

    /// The host confirms the stay happened, which opens the reviews
    pub fn complete_stay(env: &Env, host: Address, booking_id: u32) -> Result<(), Error> {
        host.require_auth();
        let mut booking = Self::host_booking(env, &host, booking_id)?;
        if booking.status == BookingStatus::Completed {
            return Err(Error::StayAlreadyCompleted);
        }
        if booking.status != BookingStatus::Confirmed {
            return Err(Error::WrongBookingStatus);
        }
        booking.status = BookingStatus::Completed;
        Self::save(env, &DataKey::Booking(booking_id), &booking);
        if let Some(mut spot) = Self::get_spot(env, booking.spot_id) {
            spot.status = SpotStatus::Done;
            Self::save(env, &DataKey::Spot(spot.id), &spot);
        }
        Ok(())
    }

    pub fn get_booking(env: &Env, booking_id: u32) -> Option<Booking> {
        env.storage().persistent().get(&DataKey::Booking(booking_id))
    }

    /// Bookings where the artist is host or guest
    pub fn list_bookings(env: &Env, artist: Address) -> Vec<Booking> {
        let ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::ArtistBookings(artist))
            .unwrap_or(Vec::new(env));
        let mut out = Vec::new(env);
        for id in ids.iter() {
            if let Some(b) = Self::get_booking(env, id) {
                out.push_back(b);
            }
        }
        out
    }

    /// Host and guest review each other, once each, only after a completed stay
    pub fn review_artist(
        env: &Env,
        reviewer: Address,
        booking_id: u32,
        score: u32,
        tags: Vec<Symbol>,
        comment: String,
    ) -> Result<(), Error> {
        reviewer.require_auth();
        let mut booking = Self::get_booking(env, booking_id).ok_or(Error::BookingNotFound)?;
        if booking.status != BookingStatus::Completed {
            return Err(Error::StayNotCompleted);
        }
        let (reviewed, role) = if reviewer == booking.host {
            if booking.host_reviewed {
                return Err(Error::AlreadyReviewed);
            }
            booking.host_reviewed = true;
            (booking.guest.clone(), ReviewerRole::Host)
        } else if reviewer == booking.guest {
            if booking.guest_reviewed {
                return Err(Error::AlreadyReviewed);
            }
            booking.guest_reviewed = true;
            (booking.host.clone(), ReviewerRole::Guest)
        } else {
            return Err(Error::NotPartOfBooking);
        };
        Self::save(env, &DataKey::Booking(booking_id), &booking);
        Self::add_review(env, reviewed, reviewer, role, score, tags, comment)
    }

    // ----- Likes and matches -----

    /// Like another artist. Returns true when it's a match (they liked you too).
    pub fn like_artist(env: &Env, from: Address, to: Address) -> Result<bool, Error> {
        from.require_auth();
        Self::get_artist(env, from.clone()).ok_or(Error::NotAnArtist)?;
        Self::get_artist(env, to.clone()).ok_or(Error::NotAnArtist)?;
        if from == to {
            return Err(Error::CannotBookOwnSpot);
        }
        let key = DataKey::Likes(from.clone());
        let mut likes = Self::list_likes(env, from.clone());
        if !likes.contains(&to) {
            likes.push_back(to.clone());
            Self::save(env, &key, &likes);
        }
        let matched = Self::list_likes(env, to.clone()).contains(&from);
        if matched {
            Matched { a: from, b: to }.publish(env);
        }
        Ok(matched)
    }

    /// Artists this artist liked
    pub fn list_likes(env: &Env, artist: Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Likes(artist))
            .unwrap_or(Vec::new(env))
    }

    // ----- Chat -----

    /// Send a short message. Only between matched artists or artists that share a booking.
    pub fn send_message(env: &Env, from: Address, to: Address, text: String) -> Result<(), Error> {
        from.require_auth();
        if text.len() == 0 || text.len() > CHAT_MAX_LEN {
            return Err(Error::InvalidMessage);
        }
        if !Self::can_chat(env, &from, &to) {
            return Err(Error::NotConnected);
        }
        let key = Self::chat_key(&from, &to);
        let mut messages = Self::list_messages(env, from.clone(), to);
        if messages.len() >= CHAT_MAX_MESSAGES {
            messages.pop_front();
        }
        messages.push_back(Message {
            from,
            text,
            timestamp: env.ledger().timestamp(),
        });
        Self::save(env, &key, &messages);
        Ok(())
    }

    pub fn list_messages(env: &Env, a: Address, b: Address) -> Vec<Message> {
        env.storage()
            .persistent()
            .get(&Self::chat_key(&a, &b))
            .unwrap_or(Vec::new(env))
    }

    /// Matched (mutual like) or sharing a booking
    pub fn can_chat(env: &Env, a: &Address, b: &Address) -> bool {
        if a == b {
            return false;
        }
        if Self::list_likes(env, a.clone()).contains(b) && Self::list_likes(env, b.clone()).contains(a) {
            return true;
        }
        Self::list_bookings(env, a.clone())
            .iter()
            .any(|bk| (bk.host == *a && bk.guest == *b) || (bk.host == *b && bk.guest == *a))
    }

    // ----- Client reviews (Poseidon commitments) -----

    /// The artist registers `Poseidon(secret)` for a session with a client.
    /// The secret only lives in the QR code the client scans; on-chain there
    /// is just the hash, so nobody can forge or reuse an invite.
    pub fn create_client_invite(env: &Env, artist: Address, commitment: U256) -> Result<(), Error> {
        artist.require_auth();
        Self::get_artist(env, artist.clone()).ok_or(Error::NotAnArtist)?;
        let key = DataKey::Invite(commitment);
        if env.storage().persistent().has(&key) {
            return Err(Error::InviteAlreadyExists);
        }
        Self::save(env, &key, &Invite { artist, used: false });
        Ok(())
    }

    /// A client reveals the secret from the QR; the contract recomputes the
    /// Poseidon hash with the native BN254 host function and burns the invite.
    pub fn review_by_client(
        env: &Env,
        client: Address,
        secret: U256,
        score: u32,
        comment: String,
    ) -> Result<Address, Error> {
        client.require_auth();
        let commitment = Self::commitment_of(env, secret)?;
        let key = DataKey::Invite(commitment);
        let mut invite: Invite = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::InviteNotFound)?;
        if invite.used {
            return Err(Error::InviteAlreadyUsed);
        }
        if invite.artist == client {
            return Err(Error::NotPartOfBooking);
        }
        invite.used = true;
        Self::save(env, &key, &invite);
        Self::add_review(
            env,
            invite.artist.clone(),
            client,
            ReviewerRole::Client,
            score,
            Vec::new(env),
            comment,
        )?;
        Ok(invite.artist)
    }

    /// Poseidon(secret) over BN254, same as circomlib / poseidon-lite `poseidon1`
    pub fn commitment_of(env: &Env, secret: U256) -> Result<U256, Error> {
        let modulus = U256::from_be_bytes(
            env,
            &bytesn!(
                env,
                0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001
            )
            .into(),
        );
        if secret >= modulus {
            return Err(Error::InvalidSecret);
        }
        Ok(poseidon_hash::<2, Bn254Fr>(env, &vec![env, secret]))
    }

    pub fn get_invite(env: &Env, commitment: U256) -> Option<Invite> {
        env.storage().persistent().get(&DataKey::Invite(commitment))
    }

    // ----- Helpers -----

    fn add_review(
        env: &Env,
        artist: Address,
        from: Address,
        role: ReviewerRole,
        score: u32,
        tags: Vec<Symbol>,
        comment: String,
    ) -> Result<(), Error> {
        if !(1..=5).contains(&score) {
            return Err(Error::InvalidScore);
        }
        let key = DataKey::Artist(artist.clone());
        let mut profile: Artist = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(Error::NotAnArtist)?;
        let was_unlocked = Self::reputation_of(&profile).home_swap_unlocked;
        profile.review_count += 1;
        profile.score_sum += score;
        Self::save(env, &key, &profile);

        let review = Review {
            from,
            role,
            score,
            tags,
            comment,
            timestamp: env.ledger().timestamp(),
        };
        let mut reviews = Self::list_reviews(env, artist.clone());
        reviews.push_back(review);
        Self::save(env, &DataKey::Reviews(artist.clone()), &reviews);

        ReviewLeft {
            artist: artist.clone(),
            role,
            score,
        }
        .publish(env);
        if !was_unlocked && Self::reputation_of(&profile).home_swap_unlocked {
            HomeSwapUnlocked { artist }.publish(env);
        }
        Ok(())
    }

    fn chat_key(a: &Address, b: &Address) -> DataKey {
        if a < b {
            DataKey::Chat(a.clone(), b.clone())
        } else {
            DataKey::Chat(b.clone(), a.clone())
        }
    }

    fn new_booking(
        env: &Env,
        spot_id: u32,
        host: Address,
        guest: Address,
        start: u64,
        end: u64,
        status: BookingStatus,
    ) -> u32 {
        let id = Self::next_id(env, &DataKey::BookingCount);
        let booking = Booking {
            id,
            spot_id,
            host: host.clone(),
            guest: guest.clone(),
            start,
            end,
            status,
            host_promo_sent: false,
            guest_promo_sent: false,
            host_reviewed: false,
            guest_reviewed: false,
        };
        Self::save(env, &DataKey::Booking(id), &booking);
        Self::index_booking(env, &host, id);
        Self::index_booking(env, &guest, id);
        SpotBooked {
            guest,
            booking_id: id,
        }
        .publish(env);
        id
    }

    fn host_booking(env: &Env, host: &Address, booking_id: u32) -> Result<Booking, Error> {
        let booking = Self::get_booking(env, booking_id).ok_or(Error::BookingNotFound)?;
        if booking.host != *host {
            return Err(Error::NotPartOfBooking);
        }
        Ok(booking)
    }

    fn reputation_of(p: &Artist) -> Reputation {
        let average_x100 = if p.review_count == 0 {
            0
        } else {
            p.score_sum * 100 / p.review_count
        };
        Reputation {
            review_count: p.review_count,
            average_x100,
            home_swap_unlocked: p.review_count >= HOME_SWAP_MIN_REVIEWS
                && p.score_sum >= HOME_SWAP_MIN_AVG * p.review_count,
        }
    }

    fn artists(env: &Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Artists)
            .unwrap_or(Vec::new(env))
    }

    fn index_booking(env: &Env, artist: &Address, booking_id: u32) {
        let key = DataKey::ArtistBookings(artist.clone());
        let mut ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        ids.push_back(booking_id);
        Self::save(env, &key, &ids);
    }

    fn next_id(env: &Env, key: &DataKey) -> u32 {
        let id: u32 = env.storage().instance().get(key).unwrap_or(0) + 1;
        env.storage().instance().set(key, &id);
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
        id
    }

    fn save<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(env: &Env, key: &DataKey, value: &V) {
        env.storage().persistent().set(key, value);
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}

mod test;
