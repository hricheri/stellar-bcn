#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

struct Setup<'a> {
    env: Env,
    client: TattooGuestSpotClient<'a>,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register(TattooGuestSpot, ());
    let client = TattooGuestSpotClient::new(&env, &id);
    Setup { env, client }
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

fn artist(t: &Setup, name: &str, city: &str) -> Address {
    let a = Address::generate(&t.env);
    t.client
        .register_artist(&a, &s(&t.env, name), &s(&t.env, city), &s(&t.env, "@ig"));
    a
}

fn studio(t: &Setup, owner: &Address) -> u32 {
    t.client
        .create_studio(owner, &s(&t.env, "Studio"), &s(&t.env, "BCN"), &Vec::new(&t.env))
}

/// Runs a full stay between host and guest and has both review each other
fn stay(t: &Setup, host: &Address, guest: &Address, host_score: u32, guest_score: u32) -> u32 {
    let spot = t
        .client
        .publish_spot(host, &studio(t, host), &100, &200, &false);
    let booking = t.client.book_spot(guest, &spot);
    t.client.complete_stay(host, &booking);
    let tags = vec![&t.env, symbol_short!("limpio")];
    t.client
        .review_artist(host, &booking, &host_score, &tags, &s(&t.env, "ok"));
    t.client
        .review_artist(guest, &booking, &guest_score, &tags, &s(&t.env, "ok"));
    booking
}

#[test]
fn full_stay_with_reviews() {
    let t = setup();
    let host = artist(&t, "Ana", "Barcelona");
    let guest = artist(&t, "Bea", "Berlin");

    let studio_id = t.client.create_studio(
        &host,
        &s(&t.env, "Ana Ink"),
        &s(&t.env, "Barcelona"),
        &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "tinta_negra")],
    );
    let spot = t.client.publish_spot(&host, &studio_id, &1_000, &2_000, &false);
    // City and supplies come from the studio
    let published = t.client.get_spot(&spot).unwrap();
    assert_eq!(published.amenities.len(), 2);
    assert_eq!(published.city, s(&t.env, "Barcelona"));
    let booking = t.client.book_spot(&guest, &spot);
    assert_eq!(t.client.get_spot(&spot).unwrap().status, SpotStatus::Booked);
    // Published dates are confirmed right away, no money involved
    let b = t.client.get_booking(&booking).unwrap();
    assert_eq!(b.status, BookingStatus::Confirmed);
    assert_eq!((b.start, b.end), (1_000, 2_000));

    // Nobody can review before the stay is done
    let none = Vec::new(&t.env);
    assert_eq!(
        t.client
            .try_review_artist(&guest, &booking, &5, &none, &s(&t.env, "x")),
        Err(Ok(Error::StayNotCompleted))
    );

    t.client.mark_promo_sent(&guest, &booking);
    assert!(t.client.get_booking(&booking).unwrap().guest_promo_sent);
    t.client.complete_stay(&host, &booking);

    t.client
        .review_artist(&guest, &booking, &5, &none, &s(&t.env, "Super limpio"));
    t.client
        .review_artist(&host, &booking, &4, &none, &s(&t.env, "Respetuosa"));
    assert_eq!(
        t.client
            .try_review_artist(&guest, &booking, &5, &none, &s(&t.env, "again")),
        Err(Ok(Error::AlreadyReviewed))
    );
    let outsider = artist(&t, "Cata", "Madrid");
    assert_eq!(
        t.client
            .try_review_artist(&outsider, &booking, &1, &none, &s(&t.env, "fake")),
        Err(Ok(Error::NotPartOfBooking))
    );

    let rep = t.client.get_reputation(&host);
    assert_eq!(rep.review_count, 1);
    assert_eq!(rep.average_x100, 500);
    assert_eq!(t.client.list_reviews(&guest).get(0).unwrap().role, ReviewerRole::Host);
    assert_eq!(t.client.list_bookings(&host).len(), 1);
}

#[test]
fn cannot_book_own_or_booked_spot() {
    let t = setup();
    let host = artist(&t, "Ana", "Barcelona");
    let guest = artist(&t, "Bea", "Berlin");
    let spot = t
        .client
        .publish_spot(&host, &studio(&t, &host), &1, &2, &false);
    assert_eq!(
        t.client.try_book_spot(&host, &spot),
        Err(Ok(Error::CannotBookOwnSpot))
    );
    t.client.book_spot(&guest, &spot);
    let other = artist(&t, "Cata", "Madrid");
    assert_eq!(
        t.client.try_book_spot(&other, &spot),
        Err(Ok(Error::SpotNotAvailable))
    );
}

#[test]
fn home_swap_unlocks_with_reputation() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    assert_eq!(
        t.client
            .try_publish_spot(&ana, &studio(&t, &ana), &1, &2, &true),
        Err(Ok(Error::NotTrustedEnough))
    );
    for _ in 0..3 {
        stay(&t, &ana, &bea, 5, 4);
    }
    assert!(t.client.get_reputation(&ana).home_swap_unlocked);
    assert!(t.client.get_reputation(&bea).home_swap_unlocked);
    let spot = t
        .client
        .publish_spot(&ana, &studio(&t, &ana), &1, &2, &true);
    assert_eq!(t.client.get_spot(&spot).unwrap().kind, symbol_short!("home"));

    // A new artist without reviews can't book a studio + home
    let newbie = artist(&t, "Dani", "Lima");
    assert_eq!(
        t.client.try_book_spot(&newbie, &spot),
        Err(Ok(Error::NotTrustedEnough))
    );
    t.client.book_spot(&bea, &spot);
}

#[test]
fn low_scores_keep_home_swap_locked() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    for _ in 0..3 {
        stay(&t, &ana, &bea, 2, 5);
    }
    assert!(!t.client.get_reputation(&bea).home_swap_unlocked);
    assert!(t.client.get_reputation(&ana).home_swap_unlocked);
}

#[test]
fn poseidon_matches_circomlib() {
    let t = setup();
    // circomlib / poseidon-lite: poseidon1([1])
    let expected = U256::from_be_bytes(
        &t.env,
        &bytesn!(
            &t.env,
            0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133
        )
        .into(),
    );
    assert_eq!(
        t.client.commitment_of(&U256::from_u32(&t.env, 1)),
        expected
    );
}

#[test]
fn client_review_with_one_time_invite() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let client = Address::generate(&t.env);
    let secret = U256::from_u128(&t.env, 0xC0FFEE_1234_5678_9abc_def0);
    let commitment = t.client.commitment_of(&secret);
    t.client.create_client_invite(&ana, &commitment);
    assert_eq!(
        t.client.try_create_client_invite(&ana, &commitment),
        Err(Ok(Error::InviteAlreadyExists))
    );

    // A wrong secret doesn't match any commitment
    assert_eq!(
        t.client.try_review_by_client(
            &client,
            &U256::from_u32(&t.env, 7),
            &5,
            &s(&t.env, "fake")
        ),
        Err(Ok(Error::InviteNotFound))
    );

    let reviewed = t
        .client
        .review_by_client(&client, &secret, &5, &s(&t.env, "Me encantó"));
    assert_eq!(reviewed, ana);
    assert!(t.client.get_invite(&commitment).unwrap().used);
    assert_eq!(
        t.client
            .try_review_by_client(&client, &secret, &5, &s(&t.env, "again")),
        Err(Ok(Error::InviteAlreadyUsed))
    );
    let reviews = t.client.list_reviews(&ana);
    assert_eq!(reviews.len(), 1);
    assert_eq!(reviews.get(0).unwrap().role, ReviewerRole::Client);
}

#[test]
fn rejects_out_of_range_inputs() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    assert_eq!(
        t.client
            .try_publish_spot(&ana, &studio(&t, &ana), &5, &5, &false),
        Err(Ok(Error::InvalidDates))
    );
    let big = U256::from_be_bytes(
        &t.env,
        &bytesn!(
            &t.env,
            0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        )
        .into(),
    );
    assert_eq!(t.client.try_commitment_of(&big), Err(Ok(Error::InvalidSecret)));
    let stranger = Address::generate(&t.env);
    assert_eq!(
        t.client.try_publish_spot(&stranger, &1, &1, &2, &false),
        Err(Ok(Error::NotAnArtist))
    );
}

#[test]
fn proposed_dates_need_the_studio() {
    let t = setup();
    let host = artist(&t, "Ana", "Barcelona");
    let guest = artist(&t, "Bea", "Berlin");
    let st = studio(&t, &host);

    assert_eq!(
        t.client.try_propose_dates(&host, &st, &1, &2),
        Err(Ok(Error::CannotBookOwnSpot))
    );
    assert_eq!(
        t.client.try_propose_dates(&guest, &st, &5, &5),
        Err(Ok(Error::InvalidDates))
    );

    // The host declines the first proposal
    let first = t.client.propose_dates(&guest, &st, &1_000, &2_000);
    let b = t.client.get_booking(&first).unwrap();
    assert_eq!(b.status, BookingStatus::Pending);
    assert_eq!(b.spot_id, NO_SPOT);
    assert_eq!(
        t.client.try_complete_stay(&host, &first),
        Err(Ok(Error::WrongBookingStatus))
    );
    assert_eq!(
        t.client.try_confirm_booking(&guest, &first),
        Err(Ok(Error::NotPartOfBooking))
    );
    t.client.decline_booking(&host, &first);
    assert_eq!(
        t.client.get_booking(&first).unwrap().status,
        BookingStatus::Declined
    );

    // ...and accepts the second one
    let second = t.client.propose_dates(&guest, &st, &3_000, &4_000);
    t.client.confirm_booking(&host, &second);
    t.client.complete_stay(&host, &second);
    assert_eq!(
        t.client.get_booking(&second).unwrap().status,
        BookingStatus::Completed
    );
    assert_eq!(t.client.list_bookings(&host).len(), 2);
}

#[test]
fn guest_changes_or_cancels_a_request() {
    let t = setup();
    let host = artist(&t, "Ana", "Barcelona");
    let guest = artist(&t, "Bea", "Berlin");
    let other = artist(&t, "Cris", "Lisbon");
    let st = studio(&t, &host);

    let id = t.client.propose_dates(&guest, &st, &1_000, &2_000);
    assert_eq!(
        t.client.try_change_request(&other, &id, &1_000, &3_000),
        Err(Ok(Error::NotPartOfBooking))
    );
    assert_eq!(
        t.client.try_change_request(&guest, &id, &3_000, &3_000),
        Err(Ok(Error::InvalidDates))
    );
    t.client.change_request(&guest, &id, &1_000, &3_000);
    let b = t.client.get_booking(&id).unwrap();
    assert_eq!((b.start, b.end, b.status), (1_000, 3_000, BookingStatus::Pending));

    t.client.cancel_request(&guest, &id);
    assert_eq!(
        t.client.get_booking(&id).unwrap().status,
        BookingStatus::Cancelled
    );
    // Too late to answer it, or change it again
    assert_eq!(
        t.client.try_confirm_booking(&host, &id),
        Err(Ok(Error::WrongBookingStatus))
    );
    assert_eq!(
        t.client.try_change_request(&guest, &id, &1_000, &2_000),
        Err(Ok(Error::WrongBookingStatus))
    );

    // Once confirmed, the dates are set
    let next = t.client.propose_dates(&guest, &st, &5_000, &6_000);
    t.client.confirm_booking(&host, &next);
    assert_eq!(
        t.client.try_cancel_request(&guest, &next),
        Err(Ok(Error::WrongBookingStatus))
    );
}

#[test]
fn likes_become_matches() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    assert!(!t.client.like_artist(&ana, &bea));
    assert!(!t.client.like_artist(&ana, &bea)); // liking twice is harmless
    assert_eq!(t.client.list_likes(&ana).len(), 1);
    assert!(t.client.like_artist(&bea, &ana));
}

#[test]
fn chat_only_between_connected_artists() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    let hi = s(&t.env, "Hola! Tienes libre en noviembre?");
    assert_eq!(
        t.client.try_send_message(&ana, &bea, &hi),
        Err(Ok(Error::NotConnected))
    );
    t.client.like_artist(&ana, &bea);
    t.client.like_artist(&bea, &ana);
    t.client.send_message(&ana, &bea, &hi);
    t.client.send_message(&bea, &ana, &s(&t.env, "Si!"));
    let msgs = t.client.list_messages(&bea, &ana);
    assert_eq!(msgs.len(), 2);
    assert_eq!(msgs.get(0).unwrap().from, ana);
    assert_eq!(
        t.client.try_send_message(&ana, &bea, &s(&t.env, "")),
        Err(Ok(Error::InvalidMessage))
    );
    for _ in 0..60 {
        t.client.send_message(&ana, &bea, &hi);
    }
    assert_eq!(t.client.list_messages(&ana, &bea).len(), CHAT_MAX_MESSAGES);
    assert_eq!(t.client.list_contacts(&bea), vec![&t.env, ana.clone()]);
}

#[test]
fn established_artists_can_write_first() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    let cata = artist(&t, "Cata", "Madrid");
    let hi = s(&t.env, "Hola! Coordinamos fechas?");
    // Ana (new) can't write to Cata without a match
    assert_eq!(
        t.client.try_send_message(&ana, &cata, &hi),
        Err(Ok(Error::NotConnected))
    );
    // Bea becomes established after three good stays with Ana
    for _ in 0..3 {
        stay(&t, &ana, &bea, 5, 5);
    }
    assert!(t.client.get_reputation(&bea).home_swap_unlocked);
    assert!(!t.client.get_reputation(&cata).home_swap_unlocked);
    t.client.send_message(&bea, &cata, &hi);
    // ...and Cata, still new, can answer the conversation Bea started
    t.client.send_message(&cata, &bea, &s(&t.env, "Claro!"));
    assert_eq!(t.client.list_messages(&cata, &bea).len(), 2);
    assert!(t.client.list_contacts(&cata).contains(&bea));
}

#[test]
fn studio_reputation_is_separate_from_its_artists() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    let cata = artist(&t, "Cata", "Madrid");
    let st = studio(&t, &ana);

    // Only studio artists can add artists or publish dates there
    assert_eq!(
        t.client.try_add_studio_artist(&cata, &st, &cata),
        Err(Ok(Error::NotStudioArtist))
    );
    assert_eq!(
        t.client.try_publish_spot(&cata, &st, &1, &2, &false),
        Err(Ok(Error::NotStudioArtist))
    );
    t.client.add_studio_artist(&ana, &st, &cata);
    assert_eq!(t.client.get_studio(&st).unwrap().members.len(), 2);

    let rep = t.client.get_studio_reputation(&st);
    assert_eq!(rep.review_count, 0);
    assert!(!rep.established && !rep.backed);

    // Bea stays at the studio three times, hosted by Ana and by Cata
    for host in [&ana, &cata, &ana] {
        let spot = t.client.publish_spot(host, &st, &1, &2, &false);
        let booking = t.client.book_spot(&bea, &spot);
        t.client.complete_stay(host, &booking);
        t.client
            .review_studio(&bea, &booking, &5, &Vec::new(&t.env), &s(&t.env, "top"));
        assert_eq!(
            t.client
                .try_review_studio(&bea, &booking, &5, &Vec::new(&t.env), &s(&t.env, "x")),
            Err(Ok(Error::AlreadyReviewed))
        );
        assert_eq!(
            t.client
                .try_review_studio(host, &booking, &5, &Vec::new(&t.env), &s(&t.env, "x")),
            Err(Ok(Error::NotPartOfBooking))
        );
    }
    let rep = t.client.get_studio_reputation(&st);
    assert_eq!(rep.review_count, 3);
    assert_eq!(rep.average_x100, 500);
    assert!(rep.established);
    assert_eq!(t.client.list_studio_reviews(&st).len(), 3);
    // The artists' own reputation doesn't move with the studio's
    assert_eq!(t.client.get_reputation(&ana).review_count, 0);
    assert_eq!(t.client.get_reputation(&cata).review_count, 0);

    // A new studio starts with a base when one of its artists is established
    let dani = artist(&t, "Dani", "Lisboa");
    for _ in 0..3 {
        stay(&t, &bea, &dani, 5, 5);
    }
    assert!(t.client.get_reputation(&bea).home_swap_unlocked);
    let new_studio = studio(&t, &bea);
    let rep = t.client.get_studio_reputation(&new_studio);
    assert!(rep.backed && !rep.established);
}

#[test]
fn any_studio_artist_can_answer_a_proposal() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let cata = artist(&t, "Cata", "Madrid");
    let bea = artist(&t, "Bea", "Berlin");
    let st = studio(&t, &ana);
    t.client.add_studio_artist(&ana, &st, &cata);

    let booking = t.client.propose_dates(&bea, &st, &1, &2);
    assert_eq!(t.client.list_bookings(&cata).len(), 1);
    t.client.confirm_booking(&cata, &booking);
    assert_eq!(t.client.get_booking(&booking).unwrap().host, cata);
    // Once confirmed, only the host who accepted closes the stay
    assert_eq!(
        t.client.try_complete_stay(&ana, &booking),
        Err(Ok(Error::NotPartOfBooking))
    );
    t.client.complete_stay(&cata, &booking);
}

#[test]
fn home_only_for_trusted_artists() {
    let t = setup();
    let ana = artist(&t, "Ana", "Barcelona");
    let bea = artist(&t, "Bea", "Berlin");
    assert_eq!(
        t.client.try_publish_home(&ana, &s(&t.env, "BCN"), &1, &2),
        Err(Ok(Error::NotTrustedEnough))
    );
    for _ in 0..3 {
        stay(&t, &bea, &ana, 5, 5);
    }
    let spot = t.client.publish_home(&ana, &s(&t.env, "BCN"), &1, &2);
    let published = t.client.get_spot(&spot).unwrap();
    assert_eq!(published.kind, symbol_short!("homeonly"));
    assert_eq!(published.studio_id, NO_STUDIO);

    let newbie = artist(&t, "Dani", "Lima");
    assert_eq!(
        t.client.try_book_spot(&newbie, &spot),
        Err(Ok(Error::NotTrustedEnough))
    );
    t.client.book_spot(&bea, &spot);
}

/// Decimal string to U256, for the seed's Poseidon commitments
fn u256(env: &Env, dec: &str) -> U256 {
    let mut be = [0u8; 32];
    for d in dec.bytes() {
        let mut carry = (d - b'0') as u32;
        for byte in be.iter_mut().rev() {
            let v = (*byte as u32) * 10 + carry;
            *byte = v as u8;
            carry = v >> 8;
        }
    }
    U256::from_be_bytes(env, &soroban_sdk::Bytes::from_array(env, &be))
}

// Generated by gen_seed.py: replays the demo seed from environments.toml

#[test]
fn demo_seed_replays() {
    let t = setup();
    let alma = Address::generate(&t.env);
    let boban = Address::generate(&t.env);
    let cliente = Address::generate(&t.env);
    let cora = Address::generate(&t.env);
    let ina = Address::generate(&t.env);
    let julim = Address::generate(&t.env);
    let roro = Address::generate(&t.env);
    let stacey = Address::generate(&t.env);
    let wilo = Address::generate(&t.env);
    let zeze = Address::generate(&t.env);
    t.client.register_artist(&wilo, &s(&t.env, "Wilo"), &s(&t.env, "Barcelona"), &s(&t.env, "@wilo.tattoo"));
    t.client.register_artist(&alma, &s(&t.env, "Alma"), &s(&t.env, "Barcelona"), &s(&t.env, "@alma.tattoo"));
    t.client.register_artist(&cora, &s(&t.env, "Cora"), &s(&t.env, "Barcelona"), &s(&t.env, "@cora.tattoo"));
    t.client.register_artist(&stacey, &s(&t.env, "Stacey"), &s(&t.env, "Perth"), &s(&t.env, "@stacey.tattoo"));
    t.client.register_artist(&roro, &s(&t.env, "Roro"), &s(&t.env, "Perth"), &s(&t.env, "@roro.tattoo"));
    t.client.register_artist(&boban, &s(&t.env, "Boban"), &s(&t.env, "Barcelona"), &s(&t.env, "@boban.tattoo"));
    t.client.register_artist(&zeze, &s(&t.env, "Zeze"), &s(&t.env, "Lisboa"), &s(&t.env, "@zeze.tattoo"));
    t.client.register_artist(&ina, &s(&t.env, "Ina"), &s(&t.env, "Berlin"), &s(&t.env, "@ina.tattoo"));
    t.client.register_artist(&julim, &s(&t.env, "Julim"), &s(&t.env, "Berlin"), &s(&t.env, "@julim.tattoo"));
    t.client.create_studio(&stacey, &s(&t.env, "Marketplace"), &s(&t.env, "Perth"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "apoyabrazos"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "cups"), Symbol::new(&t.env, "grip_tape"), Symbol::new(&t.env, "alcohol"), Symbol::new(&t.env, "jabon_quirurgico"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film"), Symbol::new(&t.env, "vaselina"), Symbol::new(&t.env, "witch_hazel"), Symbol::new(&t.env, "second_skin"), Symbol::new(&t.env, "tinta_color"), Symbol::new(&t.env, "agujas")]);
    t.client.create_studio(&ina, &s(&t.env, "Baby"), &s(&t.env, "Berlin"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "apoyabrazos"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "cups"), Symbol::new(&t.env, "grip_tape"), Symbol::new(&t.env, "alcohol"), Symbol::new(&t.env, "jabon_quirurgico"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film"), Symbol::new(&t.env, "vaselina"), Symbol::new(&t.env, "witch_hazel"), Symbol::new(&t.env, "second_skin"), Symbol::new(&t.env, "tinta_color"), Symbol::new(&t.env, "agujas")]);
    t.client.add_studio_artist(&ina, &2u32, &julim);
    t.client.create_studio(&julim, &s(&t.env, "Vision Studio"), &s(&t.env, "Berlin"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "apoyabrazos"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "cups"), Symbol::new(&t.env, "grip_tape"), Symbol::new(&t.env, "alcohol"), Symbol::new(&t.env, "jabon_quirurgico"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film"), Symbol::new(&t.env, "vaselina"), Symbol::new(&t.env, "second_skin"), Symbol::new(&t.env, "agujas")]);
    t.client.create_studio(&wilo, &s(&t.env, "Tattoo Club"), &s(&t.env, "Barcelona"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "apoyabrazos"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "cups"), Symbol::new(&t.env, "grip_tape"), Symbol::new(&t.env, "alcohol"), Symbol::new(&t.env, "jabon_quirurgico"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film"), Symbol::new(&t.env, "vaselina"), Symbol::new(&t.env, "second_skin")]);
    t.client.create_studio(&boban, &s(&t.env, "140"), &s(&t.env, "Barcelona"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "apoyabrazos"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "cups"), Symbol::new(&t.env, "grip_tape"), Symbol::new(&t.env, "alcohol"), Symbol::new(&t.env, "jabon_quirurgico"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film"), Symbol::new(&t.env, "vaselina"), Symbol::new(&t.env, "witch_hazel"), Symbol::new(&t.env, "second_skin"), Symbol::new(&t.env, "tinta_color"), Symbol::new(&t.env, "agujas")]);
    t.client.create_studio(&zeze, &s(&t.env, "Casa Angelita"), &s(&t.env, "Lisboa"), &vec![&t.env, Symbol::new(&t.env, "camilla"), Symbol::new(&t.env, "luz"), Symbol::new(&t.env, "tinta_negra"), Symbol::new(&t.env, "guantes"), Symbol::new(&t.env, "film")]);
    t.client.publish_spot(&stacey, &1u32, &1767571200u64, &1768089600u64, &false);
    t.client.book_spot(&wilo, &1u32);
    t.client.mark_promo_sent(&stacey, &1u32);
    t.client.mark_promo_sent(&wilo, &1u32);
    t.client.complete_stay(&stacey, &1u32);
    t.client.review_studio(&wilo, &1u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&wilo, &1u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&stacey, &1u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&stacey, &1u32, &1768176000u64, &1768694400u64, &false);
    t.client.book_spot(&roro, &2u32);
    t.client.complete_stay(&stacey, &2u32);
    t.client.review_studio(&roro, &2u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&roro, &2u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&stacey, &2u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&stacey, &1u32, &1768780800u64, &1769299200u64, &false);
    t.client.book_spot(&roro, &3u32);
    t.client.complete_stay(&stacey, &3u32);
    t.client.review_studio(&roro, &3u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&stacey, &3u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&stacey, &1u32, &1769385600u64, &1769904000u64, &false);
    t.client.book_spot(&roro, &4u32);
    t.client.complete_stay(&stacey, &4u32);
    t.client.review_studio(&roro, &4u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&stacey, &4u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&stacey, &1u32, &1769990400u64, &1770508800u64, &false);
    t.client.book_spot(&roro, &5u32);
    t.client.complete_stay(&stacey, &5u32);
    t.client.review_studio(&roro, &5u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&stacey, &5u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.add_studio_artist(&stacey, &1u32, &roro);
    t.client.publish_spot(&ina, &2u32, &1770595200u64, &1771113600u64, &false);
    t.client.book_spot(&wilo, &6u32);
    t.client.mark_promo_sent(&ina, &6u32);
    t.client.mark_promo_sent(&wilo, &6u32);
    t.client.complete_stay(&ina, &6u32);
    t.client.review_studio(&wilo, &6u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&wilo, &6u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&ina, &6u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&julim, &2u32, &1771200000u64, &1771718400u64, &false);
    t.client.book_spot(&wilo, &7u32);
    t.client.mark_promo_sent(&julim, &7u32);
    t.client.mark_promo_sent(&wilo, &7u32);
    t.client.complete_stay(&julim, &7u32);
    t.client.review_studio(&wilo, &7u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&wilo, &7u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&julim, &7u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&ina, &2u32, &1771804800u64, &1772323200u64, &false);
    t.client.book_spot(&wilo, &8u32);
    t.client.mark_promo_sent(&ina, &8u32);
    t.client.mark_promo_sent(&wilo, &8u32);
    t.client.complete_stay(&ina, &8u32);
    t.client.review_studio(&wilo, &8u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&wilo, &8u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&ina, &8u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&julim, &2u32, &1772409600u64, &1772928000u64, &false);
    t.client.book_spot(&stacey, &9u32);
    t.client.complete_stay(&julim, &9u32);
    t.client.review_studio(&stacey, &9u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&stacey, &9u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&ina, &2u32, &1773014400u64, &1773532800u64, &false);
    t.client.book_spot(&boban, &10u32);
    t.client.complete_stay(&ina, &10u32);
    t.client.review_studio(&boban, &10u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&boban, &10u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&julim, &2u32, &1773619200u64, &1774137600u64, &false);
    t.client.book_spot(&zeze, &11u32);
    t.client.complete_stay(&julim, &11u32);
    t.client.review_studio(&zeze, &11u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&zeze, &11u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&ina, &2u32, &1774224000u64, &1774742400u64, &false);
    t.client.book_spot(&roro, &12u32);
    t.client.complete_stay(&ina, &12u32);
    t.client.review_studio(&roro, &12u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&roro, &12u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&julim, &3u32, &1774828800u64, &1775347200u64, &false);
    t.client.book_spot(&alma, &13u32);
    t.client.complete_stay(&julim, &13u32);
    t.client.review_studio(&alma, &13u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&alma, &13u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&julim, &3u32, &1775433600u64, &1775952000u64, &false);
    t.client.book_spot(&cora, &14u32);
    t.client.complete_stay(&julim, &14u32);
    t.client.review_studio(&cora, &14u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&cora, &14u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.publish_spot(&wilo, &4u32, &1776038400u64, &1776556800u64, &false);
    t.client.book_spot(&alma, &15u32);
    t.client.complete_stay(&wilo, &15u32);
    t.client.review_artist(&wilo, &15u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&wilo, &4u32, &1776643200u64, &1777161600u64, &false);
    t.client.book_spot(&cora, &16u32);
    t.client.complete_stay(&wilo, &16u32);
    t.client.review_studio(&cora, &16u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "insumos_ok")], &s(&t.env, "Estudio impecable"));
    t.client.review_artist(&cora, &16u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "promocion")], &s(&t.env, "Gran host, todo lo prometido"));
    t.client.review_artist(&wilo, &16u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.publish_spot(&wilo, &4u32, &1777248000u64, &1777766400u64, &false);
    t.client.book_spot(&cora, &17u32);
    t.client.complete_stay(&wilo, &17u32);
    t.client.review_artist(&wilo, &17u32, &5u32, &vec![&t.env, Symbol::new(&t.env, "higiene"), Symbol::new(&t.env, "respetuosx"), Symbol::new(&t.env, "responde"), Symbol::new(&t.env, "grafica")], &s(&t.env, "Guest respetuosx y prolijx"));
    t.client.add_studio_artist(&wilo, &4u32, &alma);
    t.client.publish_spot(&boban, &5u32, &1777852800u64, &1778371200u64, &false);
    t.client.book_spot(&ina, &18u32);
    t.client.complete_stay(&boban, &18u32);
    t.client.review_studio(&ina, &18u32, &4u32, &vec![&t.env, Symbol::new(&t.env, "higiene")], &s(&t.env, "Buen estudio, faltaron algunos insumos"));
    t.client.publish_spot(&boban, &5u32, &1778457600u64, &1778976000u64, &false);
    t.client.book_spot(&julim, &19u32);
    t.client.complete_stay(&boban, &19u32);
    t.client.review_studio(&julim, &19u32, &4u32, &vec![&t.env, Symbol::new(&t.env, "higiene")], &s(&t.env, "Buen estudio, faltaron algunos insumos"));
    t.client.publish_spot(&boban, &5u32, &1779062400u64, &1779580800u64, &false);
    t.client.book_spot(&stacey, &20u32);
    t.client.complete_stay(&boban, &20u32);
    t.client.review_studio(&stacey, &20u32, &4u32, &vec![&t.env, Symbol::new(&t.env, "higiene")], &s(&t.env, "Buen estudio, faltaron algunos insumos"));
    t.client.publish_spot(&boban, &5u32, &1779667200u64, &1780185600u64, &false);
    t.client.book_spot(&roro, &21u32);
    t.client.complete_stay(&boban, &21u32);
    t.client.review_studio(&roro, &21u32, &4u32, &vec![&t.env, Symbol::new(&t.env, "higiene")], &s(&t.env, "Buen estudio, faltaron algunos insumos"));
    t.client.publish_spot(&boban, &5u32, &1780272000u64, &1780790400u64, &false);
    t.client.book_spot(&cora, &22u32);
    t.client.complete_stay(&boban, &22u32);
    t.client.review_studio(&cora, &22u32, &4u32, &vec![&t.env, Symbol::new(&t.env, "higiene")], &s(&t.env, "Buen estudio, faltaron algunos insumos"));
    t.client.create_client_invite(&boban, &u256(&t.env, "21265840062312924752660531176319105311234083680761447772888629169980570331379"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1001"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "10932972206600167674597881632825974487235966045304206808226883448777969382741"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1002"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "16656905259517475793916057696312665970193201508500698118157148083045780131455"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1003"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "7105494995731205534888177742627904831540154335809507640890458559322272679522"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1004"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "5203762478816737545089926708797642501505121160180837657743385795638543362214"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1005"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "4292259824001049523154847063692909063520224660148625648828869902571452100381"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1006"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "14331314306934712276167570911996151349345005988203767274030908083949130167682"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1007"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "11031066548264218461523102496733890444644111854873844521099220202110064003669"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1008"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "4145477656579828297469015572624693530283374145999564304725871219345700242720"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1009"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "13201645620592504317452176953026023717106018727587971399157912258077358115409"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1010"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "2337505276467781115438404436159873486975910586705615011832046911533814558947"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1011"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "4472455943317427300573823788370248790006304379656157580859400282688737184839"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1012"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "14973127926300562901626222998097489479883265885113769600160198079177271656161"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1013"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&boban, &u256(&t.env, "21570356886920307915261627891645946053804749845245146909114587366428094528065"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1014"), &5u32, &s(&t.env, "Me encanto mi tatuaje"));
    t.client.create_client_invite(&ina, &u256(&t.env, "15354645412911938846475783504903844356508754656278789983607551750935497913402"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1015"), &5u32, &s(&t.env, "Super profesional"));
    t.client.create_client_invite(&ina, &u256(&t.env, "15186552110302715466455621783893064507814969632207836353971116230209409984540"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1016"), &5u32, &s(&t.env, "Super profesional"));
    t.client.create_client_invite(&ina, &u256(&t.env, "19867760462778567301252207223507604016548380930228178984723801328812995420263"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1017"), &5u32, &s(&t.env, "Super profesional"));
    t.client.create_client_invite(&julim, &u256(&t.env, "8820011603254145365589525855728725028939057699763434250809367577031029335531"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1018"), &5u32, &s(&t.env, "Volveria sin dudas"));
    t.client.create_client_invite(&julim, &u256(&t.env, "16033562592119246090511493539984811269221585562943854682338371997809412169794"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1019"), &5u32, &s(&t.env, "Volveria sin dudas"));
    t.client.create_client_invite(&julim, &u256(&t.env, "4350692658898985541854648424693294463351361215596740333233000305362394215093"));
    t.client.review_by_client(&cliente, &u256(&t.env, "1020"), &5u32, &s(&t.env, "Volveria sin dudas"));
    t.client.publish_spot(&wilo, &4u32, &1794268800u64, &1795996800u64, &false);
    t.client.publish_spot(&ina, &2u32, &1796083200u64, &1797724800u64, &false);
    t.client.publish_spot(&julim, &3u32, &1799107200u64, &1800835200u64, &false);
    t.client.publish_spot(&stacey, &1u32, &1801440000u64, &1803772800u64, &false);
    t.client.publish_spot(&boban, &5u32, &1796083200u64, &1797292800u64, &true);
    t.client.publish_spot(&zeze, &6u32, &1793577600u64, &1794096000u64, &false);
    t.client.book_spot(&wilo, &28u32);
    t.client.propose_dates(&roro, &4u32, &1796601600u64, &1797206400u64);
    t.client.like_artist(&stacey, &wilo);
    t.client.like_artist(&wilo, &stacey);
    t.client.like_artist(&cora, &wilo);
    t.client.like_artist(&wilo, &cora);
    t.client.like_artist(&zeze, &wilo);
    t.client.like_artist(&wilo, &zeze);
    t.client.like_artist(&julim, &wilo);
    t.client.like_artist(&wilo, &ina);
    t.client.like_artist(&alma, &wilo);
    t.client.send_message(&zeze, &wilo, &s(&t.env, "Hola Wilo! Te espero en Casa Angelita en noviembre"));
    t.client.send_message(&ina, &wilo, &s(&t.env, "Wilo! Tenemos fechas libres en Baby en diciembre, te interesa?"));

    // Hui's real cases
    let rep = |a: &Address| t.client.get_reputation(a);
    let st = |id: u32| t.client.get_studio_reputation(&id);
    assert_eq!((rep(&wilo).review_count, rep(&wilo).average_x100), (5, 500));
    assert!(rep(&wilo).home_swap_unlocked);
    assert_eq!(rep(&alma).review_count, 1);
    assert_eq!(rep(&cora).review_count, 2);
    assert_eq!(rep(&stacey).review_count, 2);
    assert_eq!(rep(&roro).review_count, 4);
    assert_eq!((rep(&boban).review_count, rep(&boban).home_swap_unlocked), (14, true));
    assert_eq!(rep(&zeze).review_count, 0);
    assert!(rep(&ina).home_swap_unlocked && rep(&julim).home_swap_unlocked);
    // 1 Marketplace, 2 Baby, 3 Vision, 4 Tattoo Club, 5 140, 6 Casa Angelita
    assert_eq!((st(1).review_count, st(1).average_x100, st(1).established), (5, 500, true));
    assert!(st(2).established && st(2).review_count == 7);
    assert_eq!((st(3).review_count, st(3).established, st(3).backed), (2, false, true));
    assert_eq!((st(4).review_count, st(4).established, st(4).backed), (1, false, true));
    assert_eq!((st(5).review_count, st(5).average_x100, st(5).established), (5, 400, true));
    assert_eq!((st(6).review_count, st(6).established, st(6).backed), (0, false, false));
    assert_eq!(t.client.get_studio(&4).unwrap().members.len(), 2);
    assert_eq!(t.client.get_studio(&1).unwrap().members.len(), 2);
}
