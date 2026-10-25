import { poseidon1 } from "poseidon-lite"
// Types from the Client that `stellar scaffold` generates for our contract
import {
	type Artist,
	type Booking,
	type Reputation,
	type Spot,
	type Studio,
} from "../../../app-lib/clients/tattoo_guest_spot/dist/index.js"

export type {
	Artist,
	Booking,
	Message,
	Review,
	Spot,
	Studio,
} from "../../../app-lib/clients/tattoo_guest_spot/dist/index.js"

/** Mirrors the contract's enums (numbers on the wire) */
export const SPOT_OPEN = 0
export const SPOT_BOOKED = 1
export const ROLE_LABELS = ["Host", "Guest", "Client"] as const
export const BK_PENDING = 0
export const BK_CONFIRMED = 1
export const BK_COMPLETED = 2
export const BK_DECLINED = 3

// ----- Furniture and supplies of a studio -----

export type AmenityGroup = "mobiliario" | "basicos" | "adicionales"

export const AMENITIES: { id: string; label: string; group: AmenityGroup }[] = [
	{ id: "camilla", label: "Tattoo bed", group: "mobiliario" },
	{ id: "luz", label: "Lamp", group: "mobiliario" },
	{ id: "apoyabrazos", label: "Armrest", group: "mobiliario" },
	{ id: "tinta_negra", label: "Black ink", group: "basicos" },
	{ id: "cups", label: "Ink cups", group: "basicos" },
	{ id: "grip_tape", label: "Grip tape", group: "basicos" },
	{ id: "alcohol", label: "Alcohol / disinfectant", group: "basicos" },
	{ id: "jabon_quirurgico", label: "Surgical soap", group: "basicos" },
	{ id: "guantes", label: "Gloves", group: "basicos" },
	{ id: "film", label: "Film wrap", group: "basicos" },
	{ id: "vaselina", label: "Vaseline / butter", group: "basicos" },
	{ id: "stencil_paper", label: "Stencil paper", group: "basicos" },
	{ id: "thermal_printer", label: "Thermal printer", group: "basicos" },
	{ id: "thermal_paper", label: "Thermal paper", group: "basicos" },
	{ id: "witch_hazel", label: "Witch hazel", group: "adicionales" },
	{ id: "second_skin", label: "Second skin", group: "adicionales" },
	{ id: "tinta_color", label: "Color inks", group: "adicionales" },
	{ id: "agujas", label: "Needles", group: "adicionales" },
]

export const GROUP_LABELS: Record<AmenityGroup, string> = {
	mobiliario: "Basic furniture",
	basicos: "Basic supplies",
	adicionales: "Extra supplies",
}

/** Our label, or the artist's own item written back as words */
export const amenityLabel = (id: string) =>
	AMENITIES.find((a) => a.id === id)?.label ??
	id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ")

/** An artist's own extra item as an id Stellar accepts (letters, digits, _) */
export const customAmenityId = (text: string) =>
	text
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 32)

/** By default an artist looks for furniture + basic supplies */
/** Furniture + basic supplies: the minimum for hygiene and safety */
export const BASIC_REQUIREMENTS = AMENITIES.filter(
	(a) => a.group !== "adicionales",
).map((a) => a.id)

/** Basic requirements the studio doesn't declare */
export const missingBasics = (place: { amenities: string[] }) =>
	BASIC_REQUIREMENTS.filter((id) => !place.amenities.includes(id))

export const DEFAULT_WANTED = AMENITIES.filter(
	(a) => a.group !== "adicionales",
).map((a) => a.id)

// ----- Match between what I'm looking for and a studio -----

/** A city I want to travel to, and when */
export interface Trip {
	city: string
	/** yyyy-mm-dd, empty = flexible */
	from: string
	to: string
}

/** "What I'm looking for": my trips plus the furniture and supplies I need */
export interface Wishlist {
	trips: Trip[]
	wanted: string[]
}

export const EMPTY_TRIP: Trip = { city: "", from: "", to: "" }

export interface MatchResult {
	percent: number
	/** The trip this spot fits best */
	trip: Trip
	cityOk: boolean
	/** 0..1, share of my trip covered by the spot's dates */
	dateOverlap: number
	has: string[]
	missing: string[]
	extras: string[]
}

const WISHLIST_KEY = "tattoo-wishlist"

export const loadWishlist = (): Wishlist => {
	try {
		const saved = localStorage.getItem(WISHLIST_KEY)
		if (saved) {
			const w = JSON.parse(saved) as Partial<Wishlist> & Partial<Trip>
			// Older versions stored a single trip
			const trips = w.trips ?? [
				{ city: w.city ?? "", from: w.from ?? "", to: w.to ?? "" },
			]
			return { trips, wanted: w.wanted ?? DEFAULT_WANTED }
		}
	} catch {
		// no storage: use defaults
	}
	return { trips: [EMPTY_TRIP], wanted: DEFAULT_WANTED }
}

export const saveWishlist = (wish: Wishlist) => {
	try {
		localStorage.setItem(WISHLIST_KEY, JSON.stringify(wish))
	} catch {
		// no storage: keep it in memory only
	}
}

// Unread messages: how many messages of each chat this browser has seen
const seenKey = (me: string, other: string) => `tattoo-seen-${me}-${other}`
export const seenCount = (me: string, other: string) => {
	try {
		return Number(localStorage.getItem(seenKey(me, other)) ?? 0)
	} catch {
		return 0
	}
}
export const markSeen = (me: string, other: string, count: number) => {
	try {
		localStorage.setItem(seenKey(me, other), String(count))
	} catch {
		// no storage
	}
}

const WEIGHTS = { city: 35, dates: 35, amenities: 30 }

const normalize = (s: string) =>
	s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export const toUnix = (date: string) =>
	Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)

/** Match against every trip and keep the best one */
export function matchSpot(spot: Place, wish: Wishlist): MatchResult {
	const trips = wish.trips.length ? wish.trips : [EMPTY_TRIP]
	return trips
		.map((trip) => matchTrip(spot, trip, wish.wanted))
		.reduce((best, m) => (m.percent > best.percent ? m : best))
}

/** What matching needs from a spot (a studio with no dates has start = end = 0) */
export type Place = Pick<Spot, "city" | "amenities" | "start" | "end">

export function matchTrip(
	spot: Place,
	trip: Trip,
	wanted: string[],
): MatchResult {
	const cityOk =
		!trip.city || normalize(spot.city).includes(normalize(trip.city))

	let dateOverlap = 1
	if (trip.from && trip.to && Number(spot.end) === 0) dateOverlap = 0
	else if (trip.from && trip.to) {
		const from = toUnix(trip.from)
		const to = toUnix(trip.to)
		const overlap =
			Math.min(to, Number(spot.end)) - Math.max(from, Number(spot.start))
		dateOverlap =
			to > from ? Math.max(0, Math.min(1, overlap / (to - from))) : 0
	}

	const offered = new Set(spot.amenities)
	const has = wanted.filter((a) => offered.has(a))
	const missing = wanted.filter((a) => !offered.has(a))
	const extras = spot.amenities.filter((a) => !wanted.includes(a))
	const amenityShare = wanted.length ? has.length / wanted.length : 1

	const percent = Math.round(
		(cityOk ? WEIGHTS.city : 0) +
			dateOverlap * WEIGHTS.dates +
			amenityShare * WEIGHTS.amenities,
	)
	return { percent, trip, cityOk, dateOverlap, has, missing, extras }
}

// ----- Reputation -----

export const HOME_SWAP_MIN_REVIEWS = 3
export const HOME_SWAP_MIN_AVG = 4

export function reputationOf(artist: Artist): Reputation {
	const count = artist.review_count
	const average_x100 = count ? Math.floor((artist.score_sum * 100) / count) : 0
	return {
		review_count: count,
		average_x100,
		home_swap_unlocked:
			count >= HOME_SWAP_MIN_REVIEWS &&
			artist.score_sum >= HOME_SWAP_MIN_AVG * count,
	}
}

/** "established" once the artist reached the same bar that unlocks home swaps */
export const isEstablished = (artist: Artist) =>
	reputationOf(artist).home_swap_unlocked

// ----- Studios: their own reputation, separate from their artists' -----

/** Same thresholds as the contract */
export const STUDIO_MIN_REVIEWS = 3
export const STUDIO_MIN_AVG = 4
export const NO_STUDIO = 0

export type StudioTier = "establecido" | "respaldado" | "nuevo"

/**
 * establecido: its own reviews reach 3+ with average 4+.
 * respaldado: still new, but one of its artists is establecidx (base reputation).
 */
export function studioTier(
	studio: Studio,
	artists: Map<string, Artist>,
): StudioTier {
	if (
		studio.review_count >= STUDIO_MIN_REVIEWS &&
		studio.score_sum >= STUDIO_MIN_AVG * studio.review_count
	)
		return "establecido"
	const backed = studio.members.some((m) => {
		const a = artists.get(m)
		return a ? isEstablished(a) : false
	})
	return backed ? "respaldado" : "nuevo"
}

export const studioAvg = (studio: Studio) =>
	studio.review_count === 0
		? "—"
		: (studio.score_sum / studio.review_count).toFixed(1)

export const isStudioArtist = (
	studios: Studio[] | undefined,
	studioId: number,
	me: string,
) => (studios ?? []).some((s) => s.id === studioId && s.members.includes(me))

export const formatAvg = (artist: Artist) =>
	artist.review_count
		? (reputationOf(artist).average_x100 / 100).toFixed(1)
		: "–"

// ----- Formatting -----

export const formatDate = (unix: bigint | number) =>
	new Date(Number(unix) * 1000).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	})

export const TAG_LABELS: Record<string, string> = {
	higiene: "Hygiene and safety",
	limpio: "Clean",
	insumos_ok: "Supplies as promised",
	responde: "Replies on time",
	promocion: "Promoted my visit",
	respetuosx: "Respectful",
	ordenadx: "Tidy",
	grafica: "Posted their graphic on time",
}
export const HOST_TAGS = ["higiene", "insumos_ok", "responde", "promocion"]
/** About the place itself, when the guest reviews the studio */
export const STUDIO_TAGS = ["higiene", "insumos_ok"]
export const GUEST_TAGS = [
	"higiene",
	"respetuosx",
	"ordenadx",
	"responde",
	"grafica",
]

// ----- Client invites (Poseidon) -----

/** BN254 scalar field modulus, secrets must be smaller */
const BN254_R =
	0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n

export function newInviteSecret(): bigint {
	const bytes = crypto.getRandomValues(new Uint8Array(31)) // 248 bits < r
	return (
		BigInt(
			"0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
		) % BN254_R
	)
}

/** Same as the contract's `commitment_of`: Poseidon(secret) over BN254 */
export const commitmentOf = (secret: bigint) => poseidon1([secret])

export const inviteLink = (secret: bigint) =>
	`${window.location.origin}${window.location.pathname}#/resena/${secret.toString(16)}`

// ----- Swap dates -----

const DAY = 86_400

/** "2 – 7 Nov (6 days)" */
export function formatRange(start: bigint | number, end: bigint | number) {
	const s = new Date(Number(start) * 1000)
	const e = new Date(Number(end) * 1000)
	const days = Math.round((Number(end) - Number(start)) / DAY) + 1
	const month = (d: Date) =>
		d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
	const sameMonth = month(s) === month(e)
	const left = sameMonth ? `${s.getUTCDate()}` : `${s.getUTCDate()} ${month(s)}`
	return `${left} – ${e.getUTCDate()} ${month(e)} (${days} ${days === 1 ? "day" : "days"})`
}

/** Post a "guest artist" graphic one week before the stay */
export const PROMO_DEADLINE_DAYS = 7
export const promoDeadline = (start: bigint | number) =>
	Number(start) - PROMO_DEADLINE_DAYS * DAY

export type PendingAction =
	| "confirmar_fechas"
	| "esperando_host"
	| "enviar_grafica"
	| "confirmar_estancia"
	| "resenar"

export const ACTION_LABELS: Record<PendingAction, string> = {
	confirmar_fechas: "Answer the proposal",
	esperando_host: "Waiting for response",
	enviar_grafica: "Post the graphic",
	confirmar_estancia: "Confirm the stay",
	resenar: "Leave a review",
}

/** What `me` still has to do (or is waiting for) in a booking */
/** studioArtist: I work at the booking's studio, so I can answer its proposals */
export function pendingActions(
	b: Booking,
	me: string,
	studioArtist = false,
): PendingAction[] {
	const amHost = b.host === me || (studioArtist && b.status === BK_PENDING)
	const out: PendingAction[] = []
	if (b.status === BK_PENDING)
		out.push(amHost ? "confirmar_fechas" : "esperando_host")
	if (b.status === BK_CONFIRMED) {
		if (!(amHost ? b.host_promo_sent : b.guest_promo_sent))
			out.push("enviar_grafica")
		const started = Date.now() / 1000 >= Number(b.start)
		if (amHost && started) out.push("confirmar_estancia")
	}
	if (b.status === BK_COMPLETED) {
		const studioPending =
			!amHost && b.studio_id !== NO_STUDIO && !b.studio_reviewed
		if (!(amHost ? b.host_reviewed : b.guest_reviewed) || studioPending)
			out.push("resenar")
	}
	return out
}
