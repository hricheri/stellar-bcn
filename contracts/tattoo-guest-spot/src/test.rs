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
            .review_artist(&bea, &booking, &5, &Vec::new(&t.env), &s(&t.env, "top"));
    }
    let rep = t.client.get_studio_reputation(&st);
    assert_eq!(rep.review_count, 3);
    assert_eq!(rep.average_x100, 500);
    assert!(rep.established);
    assert_eq!(t.client.list_studio_reviews(&st).len(), 3);
    // Each artist keeps their own count
    assert_eq!(t.client.get_reputation(&ana).review_count, 2);
    assert_eq!(t.client.get_reputation(&cata).review_count, 1);

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
