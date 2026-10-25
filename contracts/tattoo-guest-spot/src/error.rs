#[soroban_sdk::contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// The address has no artist profile yet
    NotAnArtist = 1,
    /// The artist profile already exists
    AlreadyRegistered = 2,
    /// No spot with that id
    SpotNotFound = 3,
    /// The spot is already booked
    SpotNotAvailable = 4,
    /// An artist can't book their own studio
    CannotBookOwnSpot = 5,
    /// No booking with that id
    BookingNotFound = 6,
    /// Only the host or the guest of a booking can do this
    NotPartOfBooking = 7,
    /// The stay has to be completed before reviewing
    StayNotCompleted = 8,
    /// The stay was already completed
    StayAlreadyCompleted = 9,
    /// Each side can review only once per stay
    AlreadyReviewed = 10,
    /// Score must be between 1 and 5
    InvalidScore = 11,
    /// End date must be after start date
    InvalidDates = 12,
    /// The client invite commitment is unknown
    InviteNotFound = 13,
    /// The client invite was already used
    InviteAlreadyUsed = 14,
    /// The commitment was already registered
    InviteAlreadyExists = 15,
    /// The secret is not a valid BN254 field element
    InvalidSecret = 16,
    /// Studio + home swaps need a higher reputation
    NotTrustedEnough = 17,
    /// The XLM deposit could not be transferred
    DepositFailed = 18,
    /// The booking is not in the right state for this action
    WrongBookingStatus = 19,
    /// Messages must have between 1 and 280 characters
    InvalidMessage = 20,
    /// You can only chat with matches or artists you share a booking with
    NotConnected = 21,
}
