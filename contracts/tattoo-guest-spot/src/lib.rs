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
/// Reviews a studio needs (with the same average as artists) to be "establecido"
pub const STUDIO_MIN_REVIEWS: u32 = 3;

/// Reviews an artist needs before unlocking studio + home swaps
pub const HOME_SWAP_MIN_REVIEWS: u32 = 3;
/// Minimum average score (1-5) to unlock studio + home swaps
pub const HOME_SWAP_MIN_AVG: u32 = 4;

// Keep data alive for ~30 days on testnet (5s ledgers)
const TTL_THRESHOLD: u32 = 17_280 * 7;
const TTL_EXTEND_TO: u32 = 17_280 * 30;

const STUDIO: Symbol = symbol_short!("studio");
const STUDIO_HOME: Symbol = symbol_short!("home");
/// Only the artist's home, for trusted artists without a studio
const HOME_ONLY: Symbol = symbol_short!("homeonly");
/// `studio_id` of a home-only spot or a booking without a studio
pub const NO_STUDIO: u32 = 0;

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
    Studio(u32),
    StudioCount,
    StudioReviews(u32),
    /// Everyone an artist has a conversation with
    Contacts(Address),
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

/// A studio has its own reputation, separate from its artists, and can have
/// several artists. Guests review it after each stay.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Studio {
    pub id: u32,
    pub name: String,
    pub city: String,
    /// Artists who work there; any of them can publish dates and answer proposals
    pub members: Vec<Address>,
    /// Furniture and supplies the studio offers, e.g. camilla, tinta_negra, second_skin
    pub amenities: Vec<Symbol>,
    pub review_count: u32,
    pub score_sum: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StudioReputation {
    pub review_count: u32,
    /// Average score times 100 (e.g. 467 = 4.67)
    pub average_x100: u32,
    /// Its own reviews reach the threshold: "establecido"
    pub established: bool,
    /// Base reputation: at least one of its artists is "establecidx"
    pub backed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spot {
    pub id: u32,
    pub studio_id: u32,
    pub host: Address,
    pub city: String,
    /// "studio", "home" (studio + home) or "homeonly"; the last two only for trusted artists
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
    pub studio_id: u32,
    /// Studio artist in charge of the stay (any member can answer a proposal)
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

    // ----- Studios -----

    /// Create a studio. You become its first artist.
    pub fn create_studio(
        env: &Env,
        owner: Address,
        name: String,
        city: String,
        amenities: Vec<Symbol>,
    ) -> Result<u32, Error> {
        owner.require_auth();
        Self::get_artist(env, owner.clone()).ok_or(Error::NotAnArtist)?;
        let id = Self::next_id(env, &DataKey::StudioCount);
        let studio = Studio {
            id,
            name,
            city,
            members: vec![env, owner],
            amenities,
            review_count: 0,
            score_sum: 0,
        };
        Self::save(env, &DataKey::Studio(id), &studio);
        Ok(id)
    }

    /// A studio artist adds another registered artist to the studio
    pub fn add_studio_artist(
        env: &Env,
        member: Address,
        studio_id: u32,
        artist: Address,
    ) -> Result<(), Error> {
        member.require_auth();
        let mut studio = Self::member_studio(env, &member, studio_id)?;
        Self::get_artist(env, artist.clone()).ok_or(Error::NotAnArtist)?;
        if !studio.members.contains(&artist) {
            studio.members.push_back(artist);
            Self::save(env, &DataKey::Studio(studio_id), &studio);
        }
        Ok(())
    }

    /// A studio artist updates the furniture and supplies on offer
    pub fn update_studio_amenities(
        env: &Env,
        member: Address,
        studio_id: u32,
        amenities: Vec<Symbol>,
    ) -> Result<(), Error> {
        member.require_auth();
        let mut studio = Self::member_studio(env, &member, studio_id)?;
        studio.amenities = amenities;
        Self::save(env, &DataKey::Studio(studio_id), &studio);
        Ok(())
    }

    pub fn get_studio(env: &Env, studio_id: u32) -> Option<Studio> {
        env.storage().persistent().get(&DataKey::Studio(studio_id))
    }

    pub fn list_studios(env: &Env) -> Vec<Studio> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::StudioCount)
            .unwrap_or(0);
        let mut out = Vec::new(env);
        for id in 1..=count {
            if let Some(s) = Self::get_studio(env, id) {
                out.push_back(s);
            }
        }
        out
    }

    pub fn get_studio_reputation(env: &Env, studio_id: u32) -> Result<StudioReputation, Error> {
        let studio = Self::get_studio(env, studio_id).ok_or(Error::StudioNotFound)?;
        Ok(Self::studio_reputation_of(env, &studio))
    }

    pub fn list_studio_reviews(env: &Env, studio_id: u32) -> Vec<Review> {
        env.storage()
            .persistent()
            .get(&DataKey::StudioReviews(studio_id))
            .unwrap_or(Vec::new(env))
    }

    // ----- Spots and stays -----

    /// Offer your studio (or studio + home) as a guest spot between two dates.
    /// City and supplies come from the studio.
    pub fn publish_spot(
        env: &Env,
        host: Address,
        studio_id: u32,
        start: u64,
        end: u64,
        include_home: bool,
    ) -> Result<u32, Error> {
        host.require_auth();
        let profile = Self::get_artist(env, host.clone()).ok_or(Error::NotAnArtist)?;
        let studio = Self::member_studio(env, &host, studio_id)?;
        if end <= start {
            return Err(Error::InvalidDates);
        }
        if include_home && !Self::reputation_of(&profile).home_swap_unlocked {
            return Err(Error::NotTrustedEnough);
        }
        let id = Self::next_id(env, &DataKey::SpotCount);
        let spot = Spot {
            id,
            studio_id,
            host: host.clone(),
            city: studio.city,
            kind: if include_home { STUDIO_HOME } else { STUDIO },
            start,
            end,
            amenities: studio.amenities,
            status: SpotStatus::Open,
        };
        Self::save(env, &DataKey::Spot(id), &spot);
        SpotPublished { host, spot_id: id }.publish(env);
        Ok(id)
    }

    /// Trusted artists without a studio can offer only their home
    pub fn publish_home(
        env: &Env,
        host: Address,
        city: String,
        start: u64,
        end: u64,
    ) -> Result<u32, Error> {
        host.require_auth();
        let profile = Self::get_artist(env, host.clone()).ok_or(Error::NotAnArtist)?;
        if end <= start {
            return Err(Error::InvalidDates);
        }
        if !Self::reputation_of(&profile).home_swap_unlocked {
            return Err(Error::NotTrustedEnough);
        }
        let id = Self::next_id(env, &DataKey::SpotCount);
        let spot = Spot {
            id,
            studio_id: NO_STUDIO,
            host: host.clone(),
            city,
            kind: HOME_ONLY,
            start,
            end,
            amenities: Vec::new(env),
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
        if spot.kind != STUDIO && !Self::reputation_of(&guest_profile).home_swap_unlocked {
            return Err(Error::NotTrustedEnough);
        }
        spot.status = SpotStatus::Booked;
        Self::save(env, &DataKey::Spot(spot_id), &spot);
        Ok(Self::new_booking(
            env,
            spot_id,
            spot.studio_id,
            spot.host,
            guest,
            spot.start,
            spot.end,
            BookingStatus::Confirmed,
        ))
    }

    /// Propose new dates at a studio. Any of its artists reviews them and
    /// accepts (`confirm_booking`) or declines (`decline_booking`).
    pub fn propose_dates(
        env: &Env,
        guest: Address,
        studio_id: u32,
        start: u64,
        end: u64,
    ) -> Result<u32, Error> {
        guest.require_auth();
        Self::get_artist(env, guest.clone()).ok_or(Error::NotAnArtist)?;
        let studio = Self::get_studio(env, studio_id).ok_or(Error::StudioNotFound)?;
        if studio.members.contains(&guest) {
            return Err(Error::CannotBookOwnSpot);
        }
        if end <= start {
            return Err(Error::InvalidDates);
        }
        let id = Self::new_booking(
            env,
            NO_SPOT,
            studio_id,
            studio.members.get_unchecked(0),
            guest,
            start,
            end,
            BookingStatus::Pending,
        );
        // Every studio artist sees the proposal
        for m in studio.members.iter().skip(1) {
            Self::index_booking(env, &m, id);
        }
        Ok(id)
    }

    /// The host accepts the proposed dates
    pub fn confirm_booking(env: &Env, host: Address, booking_id: u32) -> Result<(), Error> {
        host.require_auth();
        let mut booking = Self::host_booking(env, &host, booking_id)?;
        if booking.status != BookingStatus::Pending {
            return Err(Error::WrongBookingStatus);
        }
        booking.status = BookingStatus::Confirmed;
        // Whoever accepts becomes the host of the stay
        booking.host = host;
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
        if role == ReviewerRole::Guest && booking.studio_id != NO_STUDIO {
            // The guest also reviews the studio, which keeps its own reputation
            if let Some(mut studio) = Self::get_studio(env, booking.studio_id) {
                if (1..=5).contains(&score) {
                    studio.review_count += 1;
                    studio.score_sum += score;
                    Self::save(env, &DataKey::Studio(studio.id), &studio);
                    let mut reviews = Self::list_studio_reviews(env, studio.id);
                    reviews.push_back(Review {
                        from: reviewer.clone(),
                        role,
                        score,
                        tags: tags.clone(),
                        comment: comment.clone(),
                        timestamp: env.ledger().timestamp(),
                    });
                    Self::save(env, &DataKey::StudioReviews(studio.id), &reviews);
                }
            }
        }
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
        let mut messages = Self::list_messages(env, from.clone(), to.clone());
        if messages.is_empty() {
            Self::add_contact(env, &from, &to);
            Self::add_contact(env, &to, &from);
        }
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

    /// Everyone this artist has a conversation with
    pub fn list_contacts(env: &Env, artist: Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Contacts(artist))
            .unwrap_or(Vec::new(env))
    }

    /// Can `a` write to `b`? Yes if they matched (mutual like), share a
    /// booking or already have a conversation. Established artists can also
    /// contact anyone first, to coordinate dates and trips.
    pub fn can_chat(env: &Env, a: &Address, b: &Address) -> bool {
        if a == b {
            return false;
        }
        if Self::list_likes(env, a.clone()).contains(b) && Self::list_likes(env, b.clone()).contains(a) {
            return true;
        }
        if Self::list_contacts(env, a.clone()).contains(b) {
            return true;
        }
        let established = Self::get_artist(env, a.clone())
            .map(|p| Self::reputation_of(&p).home_swap_unlocked)
            .unwrap_or(false);
        if established && Self::get_artist(env, b.clone()).is_some() {
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

    fn add_contact(env: &Env, artist: &Address, other: &Address) {
        let mut contacts = Self::list_contacts(env, artist.clone());
        if !contacts.contains(other) {
            contacts.push_back(other.clone());
            Self::save(env, &DataKey::Contacts(artist.clone()), &contacts);
        }
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
        studio_id: u32,
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
            studio_id,
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

    /// The booking's host, or any studio artist while a proposal is pending
    fn host_booking(env: &Env, host: &Address, booking_id: u32) -> Result<Booking, Error> {
        let booking = Self::get_booking(env, booking_id).ok_or(Error::BookingNotFound)?;
        let studio_artist = booking.status == BookingStatus::Pending
            && Self::get_studio(env, booking.studio_id)
                .map(|s| s.members.contains(host))
                .unwrap_or(false);
        if booking.host != *host && !studio_artist {
            return Err(Error::NotPartOfBooking);
        }
        Ok(booking)
    }

    fn member_studio(env: &Env, member: &Address, studio_id: u32) -> Result<Studio, Error> {
        let studio = Self::get_studio(env, studio_id).ok_or(Error::StudioNotFound)?;
        if !studio.members.contains(member) {
            return Err(Error::NotStudioArtist);
        }
        Ok(studio)
    }

    fn studio_reputation_of(env: &Env, studio: &Studio) -> StudioReputation {
        let average_x100 = if studio.review_count == 0 {
            0
        } else {
            studio.score_sum * 100 / studio.review_count
        };
        StudioReputation {
            review_count: studio.review_count,
            average_x100,
            established: studio.review_count >= STUDIO_MIN_REVIEWS
                && studio.score_sum >= HOME_SWAP_MIN_AVG * studio.review_count,
            backed: studio.members.iter().any(|m| {
                Self::get_artist(env, m)
                    .map(|a| Self::reputation_of(&a).home_swap_unlocked)
                    .unwrap_or(false)
            }),
        }
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
