import { tattooGuestSpot } from "@stellar-scaffold/app-lib/clients"
import { useQueries } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { BookingActions } from "../components/BookingActions"
import { Chat } from "../components/Chat"
import { type Connection, FlipCard } from "../components/FlipCard"
import { ProposeDates } from "../components/ProposeDates"
import { type CalendarEvent, SwapCalendar } from "../components/SwapCalendar"
import { MatchRing, PageTitle, TierBadge } from "../components/TattooUI"
import {
	useAllLikes,
	useContacts,
	useArtist,
	useArtists,
	useBookings,
	useLikes,
	useSend,
	useStudios,
	useSpots,
} from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	ACTION_LABELS,
	BK_CONFIRMED,
	BK_DECLINED,
	BK_PENDING,
	formatRange,
	loadWishlist,
	matchSpot,
	isStudioArtist,
	isEstablished,
	pendingActions,
	promoDeadline,
	seenCount,
	SPOT_OPEN,
} from "../lib/tattoo"

export const SECTIONS = ["favoritos", "swaps", "calendario"] as const
type Section = (typeof SECTIONS)[number]

/** Circular carousel: after the last card comes the first one again */
const Carousel = ({
	items,
	render,
	empty,
}: {
	items: Connection[]
	render: (c: Connection) => React.ReactNode
	empty: string
}) => {
	const [i, setI] = useState(0)
	if (items.length === 0)
		return <div className="ts-card empty-state">{empty}</div>
	const idx = ((i % items.length) + items.length) % items.length
	const current = items[idx]!
	return (
		<div className="carousel">
			<button
				className="carousel-arrow"
				onClick={() => setI(idx - 1)}
				aria-label="Anterior"
				disabled={items.length < 2}
			>
				‹
			</button>
			<div className="carousel-track">
				<div key={current.artist.address} className="carousel-slide">
					{render(current)}
				</div>
			</div>
			<button
				className="carousel-arrow"
				onClick={() => setI(idx + 1)}
				aria-label="Siguiente"
				disabled={items.length < 2}
			>
				›
			</button>
			<div className="carousel-dots">
				{items.map((c, n) => (
					<button
						key={c.artist.address}
						className={`dot${n === idx ? " on" : ""}${c.actions.length || c.unread ? " alert" : ""}`}
						onClick={() => setI(n)}
						aria-label={c.artist.name}
					/>
				))}
			</div>
		</div>
	)
}

const MySwaps = ({ section }: { section: Section }) => {
	const { address } = useWallet()
	const me = useArtist(address)
	const artists = useArtists()
	const spots = useSpots()
	const bookings = useBookings(address)
	const myLikes = useLikes(address)
	const allAddresses = useMemo(
		() => (artists.data ?? []).map((a) => a.address),
		[artists.data],
	)
	const allLikes = useAllLikes(allAddresses)
	const send = useSend()
	const studios = useStudios()
	const contacts = useContacts(address)
	const [chatOpen, setChatOpen] = useState<string>()

	// ----- Scroll-spy: the side menu follows the section on screen -----
	const navigate = useNavigate()
	const location = useLocation()
	const fromScroll = useRef(false)
	const refs = {
		favoritos: useRef<HTMLElement>(null),
		swaps: useRef<HTMLElement>(null),
		calendario: useRef<HTMLElement>(null),
	}

	useEffect(() => {
		if (fromScroll.current) {
			fromScroll.current = false
			return
		}
		refs[section].current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [section, location.key])

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
				const id = visible?.target.id as Section | undefined
				if (id && id !== section) {
					fromScroll.current = true
					void navigate(`/${id}`, { replace: true })
				}
			},
			{ rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
		)
		Object.values(refs).forEach((r) => r.current && observer.observe(r.current))
		return () => observer.disconnect()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [section, navigate, address, me.data])

	// ----- Who is connected to me -----
	const wish = useMemo(loadWishlist, [])
	const data = useMemo(() => {
		if (!address) return undefined
		const mine = new Set(myLikes.data ?? [])
		const talkedTo = new Set(contacts.data ?? [])
		const meProfile = (artists.data ?? []).find((a) => a.address === address)
		// Established artists can write to anyone, without a match
		const iCanWriteFirst = meProfile ? isEstablished(meProfile) : false
		const likedMe = new Set(
			[...(allLikes.data?.entries() ?? [])]
				.filter(([, likes]) => likes.includes(address))
				.map(([a]) => a),
		)
		const spotsById = new Map((spots.data ?? []).map((s) => [s.id, s]))
		const activeBookings = (bookings.data ?? []).filter(
			(b) => b.status !== BK_DECLINED,
		)

		const connections: Connection[] = []
		for (const artist of artists.data ?? []) {
			if (artist.address === address) continue
			const booking = [...activeBookings]
				.reverse()
				.find((b) => b.host === artist.address || b.guest === artist.address)
			const isMatch = mine.has(artist.address) && likedMe.has(artist.address)
			const kind = isMatch
				? "match"
				: mine.has(artist.address)
					? "liked"
					: likedMe.has(artist.address)
						? "likedMe"
						: talkedTo.has(artist.address)
							? "contact"
							: undefined
			if (!kind && !booking) continue
			const spot = (spots.data ?? []).find(
				(s) => s.host === artist.address && s.status === SPOT_OPEN,
			)
			const bookingSpot = booking ? spotsById.get(booking.spot_id) : undefined
			const shown = bookingSpot ?? spot
			connections.push({
				artist,
				kind: kind ?? "match",
				spot,
				booking,
				bookingSpot,
				match: shown ? matchSpot(shown, wish) : undefined,
				actions: booking
					? pendingActions(
							booking,
							address,
							isStudioArtist(studios.data, booking.studio_id, address),
						)
					: [],
				unread: 0,
				canChat:
					isMatch ||
					!!booking ||
					talkedTo.has(artist.address) ||
					iCanWriteFirst,
			})
		}
		return connections
	}, [
		address,
		myLikes.data,
		allLikes.data,
		artists.data,
		spots.data,
		bookings.data,
		wish,
		studios.data,
		contacts.data,
	])

	// Unread messages per connection
	const chatQueries = useQueries({
		queries: (data ?? [])
			.filter((c) => c.canChat)
			.map((c) => ({
				queryKey: ["messages", address, c.artist.address],
				refetchInterval: 15000,
				queryFn: async () =>
					(
						await tattooGuestSpot.list_messages({
							a: address!,
							b: c.artist.address,
						})
					).result,
			})),
	})
	const withUnread = useMemo(() => {
		const chatting = (data ?? []).filter((c) => c.canChat)
		const counts = new Map(
			chatting.map((c, n) => {
				const msgs = chatQueries[n]?.data ?? []
				const seen = seenCount(address!, c.artist.address)
				const unread = msgs
					.slice(seen)
					.filter((m) => m.from === c.artist.address).length
				return [c.artist.address, unread] as const
			}),
		)
		return (data ?? []).map((c) => ({
			...c,
			unread: counts.get(c.artist.address) ?? 0,
		}))
	}, [data, chatQueries, address])

	const urgency = (c: Connection) =>
		(c.actions.filter((a) => a !== "esperando_host").length ? 2 : 0) +
		(c.unread ? 1 : 0)
	const matches = withUnread
		.filter((c) => c.kind === "match" || c.booking)
		.sort((a, b) => urgency(b) - urgency(a))
	const liked = withUnread
		.filter(
			(c) =>
				(c.kind === "liked" || c.kind === "likedMe" || c.kind === "contact") &&
				!c.booking,
		)
		.sort((a, b) => b.unread - a.unread || (a.kind === "likedMe" ? -1 : 1))

	// ----- Calendar events -----
	const events = useMemo<CalendarEvent[]>(() => {
		if (!address) return []
		const out: CalendarEvent[] = []
		for (const s of spots.data ?? []) {
			if (s.host === address && s.status === SPOT_OPEN) {
				out.push({
					kind: "available",
					start: Number(s.start),
					end: Number(s.end),
					label: `Tu estudio libre en ${s.city}`,
				})
			}
		}
		for (const c of withUnread) {
			const b = c.booking
			const s = c.bookingSpot
			const city =
				s?.city ?? (b?.host === address ? "tu estudio" : c.artist.city)
			if (b && b.status === BK_CONFIRMED) {
				const amHost = b.host === address
				out.push({
					kind: "confirmed",
					start: Number(b.start),
					end: Number(b.end),
					label: amHost
						? `${c.artist.name} en tu estudio`
						: `Vas al estudio de ${c.artist.name} (${city})`,
				})
				if (!(amHost ? b.host_promo_sent : b.guest_promo_sent)) {
					const d = promoDeadline(b.start)
					out.push({
						kind: "deadline",
						start: d,
						end: d,
						label: `Enviar gráfica de guest artist (${c.artist.name})`,
					})
				}
			} else if (b && b.status === BK_PENDING) {
				out.push({
					kind: "proposed",
					start: Number(b.start),
					end: Number(b.end),
					label: `Propuesta con ${c.artist.name} (${city})`,
				})
			} else if (!b && c.kind === "match" && c.spot) {
				out.push({
					kind: "proposed",
					start: Number(c.spot.start),
					end: Number(c.spot.end),
					label: `${c.artist.name} libre en ${c.spot.city}`,
				})
			}
		}
		return out
	}, [address, spots.data, withUnread])

	if (!address || !me.data) {
		return (
			<>
				<PageTitle title="Mis swaps" />
				<div className="alert alert-info">
					{address ? (
						<>
							Primero <Link to="/perfil">crea tu perfil</Link>.
						</>
					) : (
						<>
							Conecta tu wallet o toca <b>Probar sin wallet</b> arriba.
						</>
					)}
				</div>
			</>
		)
	}

	const like = (to: string) =>
		void send((cl, from, o) => cl.like_artist({ from, to }, o)).catch(() => {})
	const spotsOf = (a: string) => (spots.data ?? []).filter((s) => s.host === a)

	return (
		<div className="unified">
			<section id="favoritos" ref={refs.favoritos} className="unified-section">
				<PageTitle
					title="Favoritos"
					subtitle="Toca una tarjeta para darla vuelta y chatear."
				/>
				<div className="split-title">
					<h2>♥ Matches</h2>
					<span className="hint">Primero, los que tienen algo pendiente</span>
				</div>
				<Carousel
					items={matches}
					empty="Todavía no tienes matches. Dale like a artistas en Explorar."
					render={(c) => (
						<FlipCard
							c={c}
							me={address}
							meProfile={me.data}
							theirSpots={spotsOf(c.artist.address)}
						/>
					)}
				/>
				<div className="split-title">
					<h2>♡ Likes y conversaciones</h2>
					<span className="hint">Primero, los mensajes sin leer</span>
				</div>
				<Carousel
					items={liked}
					empty="Sin likes pendientes."
					render={(c) => (
						<FlipCard
							c={c}
							me={address}
							meProfile={me.data}
							theirSpots={spotsOf(c.artist.address)}
							onLike={() => like(c.artist.address)}
						/>
					)}
				/>
			</section>

			<section id="swaps" ref={refs.swaps} className="unified-section">
				<PageTitle
					title="Swaps"
					subtitle="Tus matches en lista, con lo que falta hacer en cada uno."
				/>
				{matches.length === 0 && (
					<div className="ts-card empty-state">Sin swaps todavía.</div>
				)}
				<div className="ts-card">
					{matches.map((c) => {
						const s = c.bookingSpot ?? c.spot
						return (
							<div key={c.artist.address} className="swap-row">
								<div className="swap-main">
									{c.match ? (
										<MatchRing percent={c.match.percent} />
									) : (
										<div style={{ width: 64 }} />
									)}
									<div style={{ flex: 1, minWidth: 0 }}>
										<div className="swap-city">{s?.city ?? c.artist.city}</div>
										<div className="host-name">
											{c.artist.name} <TierBadge artist={c.artist} />
										</div>
										<div className="meta">
											{c.booking
												? `📅 ${formatRange(c.booking.start, c.booking.end)}`
												: s
													? `📅 Libre ${formatRange(s.start, s.end)}`
													: "Sin fechas propuestas"}
											{c.booking?.status === BK_PENDING &&
												" · esperando respuesta"}
											{c.booking?.status === BK_CONFIRMED && " · ✓ confirmado"}
										</div>
									</div>
									<div className="swap-icons">
										<button
											className={`icon-btn${c.unread ? " has-unread" : ""}`}
											title="Chat"
											onClick={() =>
												setChatOpen(
													chatOpen === c.artist.address
														? undefined
														: c.artist.address,
												)
											}
										>
											💬
											{c.unread > 0 && (
												<span className="badge">{c.unread}</span>
											)}
										</button>
										<Link
											to={`/artista/${c.artist.address}`}
											className="icon-btn"
											title="Perfil"
										>
											👤
										</Link>
									</div>
								</div>
								<div className="swap-actions">
									{c.booking ? (
										<BookingActions
											booking={c.booking}
											me={address}
											other={c.artist}
										/>
									) : c.spot ? (
										<button
											className="btn-lime"
											onClick={() =>
												void send((cl, guest, o) =>
													cl.book_spot({ guest, spot_id: c.spot!.id }, o),
												).catch(() => {})
											}
										>
											Reservar estas fechas
										</button>
									) : null}
									{!c.booking && <ProposeDates host={c.artist.address} />}
									{c.actions.length === 0 && c.booking && (
										<span className="hint">Nada pendiente ✓</span>
									)}
									{c.actions.length > 0 && (
										<span className="hint">
											Pendiente:{" "}
											{c.actions.map((a) => ACTION_LABELS[a]).join(" · ")}
										</span>
									)}
								</div>
								{chatOpen === c.artist.address && (
									<div style={{ marginTop: "0.75rem" }}>
										<Chat me={address} other={c.artist} canChat={c.canChat} />
									</div>
								)}
							</div>
						)
					})}
				</div>
			</section>

			<section
				id="calendario"
				ref={refs.calendario}
				className="unified-section"
			>
				<PageTitle
					title="Calendario"
					subtitle="Tu disponibilidad, swaps confirmados, propuestas de tus matches y deadlines."
				/>
				<div className="ts-card">
					<div className="ts-card-body">
						<SwapCalendar events={events} />
					</div>
				</div>
			</section>
		</div>
	)
}

export default MySwaps
