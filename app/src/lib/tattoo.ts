import { poseidon1 } from "poseidon-lite"
// Types from the Client that `stellar scaffold` generates for our contract
import  {
	type Artist,
	type Booking,
	type Reputation,
	type Spot,
} from "../../../app-lib/clients/tattoo_guest_spot/dist/index.js"

export type {
	Artist,
	Booking,
	Message,
	Review,
	Spot,
} from "../../../app-lib/clients/tattoo_guest_spot/dist/index.js"

/** Mirrors the contract's enums (numbers on the wire) */
export const SPOT_OPEN = 0
export const SPOT_BOOKED = 1
export const ROLE_LABELS = ["Host", "Guest", "Cliente"] as const
export const BK_PENDING = 0
export const BK_CONFIRMED = 1
export const BK_COMPLETED = 2
export const BK_DECLINED = 3

// ----- Equipamiento e insumos de un estudio -----

export type AmenityGroup = "mobiliario" | "basicos" | "adicionales"

export const AMENITIES: { id: string; label: string; group: AmenityGroup }[] = [
	{ id: "camilla", label: "Camilla", group: "mobiliario" },
	{ id: "luz", label: "Luz", group: "mobiliario" },
	{ id: "apoyabrazos", label: "Apoyabrazos", group: "mobiliario" },
	{ id: "tinta_negra", label: "Tinta negra", group: "basicos" },
	{ id: "cups", label: "Cups", group: "basicos" },
	{ id: "grip_tape", label: "Grip tape", group: "basicos" },
	{ id: "alcohol", label: "Alcohol / desinfectante", group: "basicos" },
	{ id: "jabon_quirurgico", label: "Jabón quirúrgico", group: "basicos" },
	{ id: "guantes", label: "Guantes", group: "basicos" },
	{ id: "film", label: "Film wrap", group: "basicos" },
	{ id: "vaselina", label: "Vaselina / butter", group: "basicos" },
	{ id: "witch_hazel", label: "Witch hazel", group: "adicionales" },
	{ id: "second_skin", label: "Second skin", group: "adicionales" },
	{ id: "tinta_color", label: "Tintas de color", group: "adicionales" },
	{ id: "agujas", label: "Agujas", group: "adicionales" },
]

export const GROUP_LABELS: Record<AmenityGroup, string> = {
	mobiliario: "Mobiliario básico",
	basicos: "Insumos básicos",
	adicionales: "Insumos adicionales",
}

export const amenityLabel = (id: string) =>
	AMENITIES.find((a) => a.id === id)?.label ?? id

/** By default an artist looks for furniture + basic supplies */
export const DEFAULT_WANTED = AMENITIES.filter(
	(a) => a.group !== "adicionales",
).map((a) => a.id)

// ----- Match entre lo que busco y un estudio -----

export interface Wishlist {
	city: string
	/** yyyy-mm-dd, empty = flexible */
	from: string
	to: string
	wanted: string[]
}

export interface MatchResult {
	percent: number
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
		if (saved) return JSON.parse(saved) as Wishlist
	} catch {
		// no storage: use defaults
	}
	return { city: "", from: "", to: "", wanted: DEFAULT_WANTED }
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
	s
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.trim()

export const toUnix = (date: string) =>
	Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000)

export function matchSpot(spot: Spot, wish: Wishlist): MatchResult {
	const cityOk =
		!wish.city || normalize(spot.city).includes(normalize(wish.city))

	let dateOverlap = 1
	if (wish.from && wish.to) {
		const from = toUnix(wish.from)
		const to = toUnix(wish.to)
		const overlap =
			Math.min(to, Number(spot.end)) - Math.max(from, Number(spot.start))
		dateOverlap = to > from ? Math.max(0, Math.min(1, overlap / (to - from))) : 0
	}

	const offered = new Set(spot.amenities)
	const has = wish.wanted.filter((a) => offered.has(a))
	const missing = wish.wanted.filter((a) => !offered.has(a))
	const extras = spot.amenities.filter((a) => !wish.wanted.includes(a))
	const amenityShare = wish.wanted.length ? has.length / wish.wanted.length : 1

	const percent = Math.round(
		(cityOk ? WEIGHTS.city : 0) +
			dateOverlap * WEIGHTS.dates +
			amenityShare * WEIGHTS.amenities,
	)
	return { percent, cityOk, dateOverlap, has, missing, extras }
}

// ----- Reputación -----

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

/** "establecidx" once the artist reached the same bar that unlocks home swaps */
export const isEstablished = (artist: Artist) =>
	reputationOf(artist).home_swap_unlocked

export const formatAvg = (artist: Artist) =>
	artist.review_count
		? (reputationOf(artist).average_x100 / 100).toFixed(1)
		: "–"

// ----- Formato -----

export const formatDate = (unix: bigint | number) =>
	new Date(Number(unix) * 1000).toLocaleDateString("es-ES", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	})

export const STROOPS = 10_000_000n
export const formatXlm = (stroops: bigint) =>
	stroops === 0n ? "Sin depósito" : `${Number(stroops) / Number(STROOPS)} XLM`

export const TAG_LABELS: Record<string, string> = {
	limpio: "Limpio",
	insumos_ok: "Insumos prometidos",
	responde: "Responde a tiempo",
	promocion: "Promocionó mi visita",
	respetuosx: "Respetuosx",
	limpix: "Limpix",
	ordenadx: "Ordenadx",
	grafica: "Hizo su gráfica a tiempo",
}
export const HOST_TAGS = ["limpio", "insumos_ok", "responde", "promocion"]
export const GUEST_TAGS = ["respetuosx", "limpix", "ordenadx", "responde", "grafica"]

// ----- Invitaciones para clientes (Poseidon) -----

/** BN254 scalar field modulus, secrets must be smaller */
const BN254_R =
	0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n

export function newInviteSecret(): bigint {
	const bytes = crypto.getRandomValues(new Uint8Array(31)) // 248 bits < r
	return BigInt(
		"0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
	) % BN254_R
}

/** Same as the contract's `commitment_of`: Poseidon(secret) over BN254 */
export const commitmentOf = (secret: bigint) => poseidon1([secret])

export const inviteLink = (secret: bigint) =>
	`${window.location.origin}${window.location.pathname}#/resena/${secret.toString(16)}`

// ----- Fechas de swaps -----

const DAY = 86_400

/** "2 – 7 nov (6 días)" */
export function formatRange(start: bigint | number, end: bigint | number) {
	const s = new Date(Number(start) * 1000)
	const e = new Date(Number(end) * 1000)
	const days = Math.round((Number(end) - Number(start)) / DAY) + 1
	const month = (d: Date) =>
		d.toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" })
	const sameMonth = month(s) === month(e)
	const left = sameMonth
		? `${s.getUTCDate()}`
		: `${s.getUTCDate()} ${month(s)}`
	return `${left} – ${e.getUTCDate()} ${month(e)} (${days} ${days === 1 ? "día" : "días"})`
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
	confirmar_fechas: "Confirmar fechas",
	esperando_host: "Esperando confirmación",
	enviar_grafica: "Enviar gráfica a redes",
	confirmar_estancia: "Confirmar estancia",
	resenar: "Dejar reseña",
}

/** What `me` still has to do (or is waiting for) in a booking */
export function pendingActions(
	b: Booking,
	me: string,
	spotStart?: bigint,
): PendingAction[] {
	const amHost = b.host === me
	const out: PendingAction[] = []
	if (b.status === BK_PENDING) out.push(amHost ? "confirmar_fechas" : "esperando_host")
	if (b.status === BK_CONFIRMED) {
		if (!(amHost ? b.host_promo_sent : b.guest_promo_sent)) out.push("enviar_grafica")
		const started = spotStart === undefined || Date.now() / 1000 >= Number(spotStart)
		if (amHost && started) out.push("confirmar_estancia")
	}
	if (b.status === BK_COMPLETED && !(amHost ? b.host_reviewed : b.guest_reviewed))
		out.push("resenar")
	return out
}
