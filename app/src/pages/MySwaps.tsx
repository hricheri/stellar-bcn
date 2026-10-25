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
	BK_CONFIRMED,
	BK_DECLINED,
	BK_PENDING,
	formatDate,
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
				aria-label="Previous"
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
				aria-label="Next"
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

type SwapGroup = "new" | "requests" | "sent" | "confirmed"

const SWAP_GROUPS: { id: SwapGroup; title: string; hint: string }[] = [
	{ id: "new", title: "🎉 New matches", hint: "Pick your dates" },
	{ id: "requests", title: "Swap requests for you", hint: "Accept or decline" },
	{ id: "sent", title: "Sent requests", hint: "Waiting for their answer" },
	{ id: "confirmed", title: "📅 Confirmed swaps", hint: "Get ready!" },
]

/** Which block of Swaps a connection goes in */
const swapGroup = (c: Connection): SwapGroup => {
	const b = c.booking
	if (!b) return "new"
	if (b.status === BK_PENDING)
		return c.actions.includes("confirmar_fechas") ? "requests" : "sent"
	return "confirmed"
}

/** "View details" of a confirmed swap: dates, place, contact and what to do next */
const SwapDetails = ({
	c,
	me,
	city,
	studioName,
}: {
	c: Connection
	me: string
	city: string
	studioName?: string
}) => {
	const [open, setOpen] = useState(false)
	const b = c.booking!
	if (!open)
		return (
			<button className="btn-ghost" onClick={() => setOpen(true)}>
				View details
			</button>
		)
	return (
		<div className="swap-details">
			<div>
				<b>Where:</b> {studioName ? `${studioName}, ${city}` : city}
			</div>
			<div>
				<b>When:</b> {formatRange(b.start, b.end)}
			</div>
			<div>
				<b>Contact:</b> {c.artist.name} · {c.artist.instagram || "chat"}
			</div>
			<p className="hint">
				The exact address and how to get in are shared privately in the chat:
				everything on Stellar is public, so we never store them there.
			</p>
			<div className="alert alert-info">
				📸 Send a photo of one of your tattoos within 48 h so they can announce
				your guest spot on social media. Graphic deadline:{" "}
				{formatDate(promoDeadline(b.start))}.
			</div>
			<BookingActions booking={b} me={me} other={c.artist} />
			<button className="btn-ghost" onClick={() => setOpen(false)}>
				Hide details
			</button>
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
					label: `Your studio is free in ${s.city}`,
				})
			}
		}
		for (const c of withUnread) {
			const b = c.booking
			const s = c.bookingSpot
			const city =
				s?.city ?? (b?.host === address ? "your studio" : c.artist.city)
			if (b && b.status === BK_CONFIRMED) {
				const amHost = b.host === address
				out.push({
					kind: "confirmed",
					start: Number(b.start),
					end: Number(b.end),
					label: amHost
						? `${c.artist.name} at your studio`
						: `You go to ${c.artist.name}'s studio (${city})`,
				})
				if (!(amHost ? b.host_promo_sent : b.guest_promo_sent)) {
					const d = promoDeadline(b.start)
					out.push({
						kind: "deadline",
						start: d,
						end: d,
						label: `Post the guest artist graphic (${c.artist.name})`,
					})
				}
			} else if (b && b.status === BK_PENDING) {
				out.push({
					kind: "proposed",
					start: Number(b.start),
					end: Number(b.end),
					label: `Proposal with ${c.artist.name} (${city})`,
				})
			} else if (!b && c.kind === "match" && c.spot) {
				out.push({
					kind: "proposed",
					start: Number(c.spot.start),
					end: Number(c.spot.end),
					label: `${c.artist.name} free in ${c.spot.city}`,
				})
			}
		}
		return out
	}, [address, spots.data, withUnread])

	if (!address || !me.data) {
		return (
			<>
				<PageTitle title="My swaps" />
				<div className="alert alert-info">
					{address ? (
						<>
							First <Link to="/perfil">create your profile</Link>.
						</>
					) : (
						<>
							Tap <b>Sign in</b> at the top.
						</>
					)}
				</div>
			</>
		)
	}

	const like = (to: string) =>
		void send((cl, from, o) => cl.like_artist({ from, to }, o)).catch(() => {})
	const spotsOf = (a: string) => (spots.data ?? []).filter((s) => s.host === a)

	const swapRow = (c: Connection, group: SwapGroup) => {
		const s = c.bookingSpot ?? c.spot
		const city = s?.city ?? c.artist.city
		const b = c.booking
		const amHost = b?.host === address
		return (
			<div key={c.artist.address} className="swap-row">
				{group === "confirmed" && b && (
					<div className="swap-headline">
						{amHost
							? `🏠 ${c.artist.name} is coming to your studio!`
							: `✈️ You're going to ${city}!`}
					</div>
				)}
				<div className="swap-main">
					{c.match ? (
						<MatchRing percent={c.match.percent} />
					) : (
						<div style={{ width: 64 }} />
					)}
					<div style={{ flex: 1, minWidth: 0 }}>
						<div className="swap-city">{city}</div>
						<div className="host-name">
							{c.artist.name} <TierBadge artist={c.artist} />
						</div>
						<div className="meta">
							{b
								? `📅 ${formatRange(b.start, b.end)}`
								: s
									? `📅 Free ${formatRange(s.start, s.end)}`
									: "No dates yet"}
						</div>
					</div>
					<div className="swap-icons">
						<button
							className={`icon-btn${c.unread ? " has-unread" : ""}`}
							title="Chat"
							onClick={() =>
								setChatOpen(
									chatOpen === c.artist.address ? undefined : c.artist.address,
								)
							}
						>
							💬
							{c.unread > 0 && <span className="badge">{c.unread}</span>}
						</button>
						<Link
							to={`/artista/${c.artist.address}`}
							className="icon-btn"
							title="Profile"
						>
							👤
						</Link>
					</div>
				</div>
				<div className="swap-actions">
					{group === "new" && c.spot && (
						<button
							className="btn-lime"
							onClick={() =>
								void send((cl, guest, o) =>
									cl.book_spot({ guest, spot_id: c.spot!.id }, o),
								).catch(() => {})
							}
						>
							Book these dates
						</button>
					)}
					{group === "new" && <ProposeDates host={c.artist.address} />}
					{b && group !== "confirmed" && (
						<BookingActions booking={b} me={address} other={c.artist} />
					)}
					{b && group === "confirmed" && (
						<SwapDetails
							c={c}
							me={address}
							city={city}
							studioName={
								(studios.data ?? []).find((st) => st.id === b.studio_id)?.name
							}
						/>
					)}
				</div>
				{chatOpen === c.artist.address && (
					<div style={{ marginTop: "0.75rem" }}>
						<Chat me={address} other={c.artist} canChat={c.canChat} />
					</div>
				)}
			</div>
		)
	}

	return (
		<div className="unified">
			<section id="favoritos" ref={refs.favoritos} className="unified-section">
				<PageTitle
					title="Favorites"
					subtitle="Tap a card to flip it and chat."
				/>
				<div className="split-title">
					<h2>♥ Matches</h2>
					<span className="hint">Those with something to do come first</span>
				</div>
				<Carousel
					items={matches}
					empty="No matches yet. Like some artists in Explore."
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
					<h2>♡ Likes and conversations</h2>
					<span className="hint">Unread messages come first</span>
				</div>
				<Carousel
					items={liked}
					empty="No pending likes."
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
					subtitle="Your matches, step by step: set dates, answer, travel."
				/>
				{matches.length === 0 && (
					<div className="ts-card empty-state">No swaps yet.</div>
				)}
				{SWAP_GROUPS.map((g) => {
					const items = matches.filter((c) => swapGroup(c) === g.id)
					if (items.length === 0) return null
					return (
						<div key={g.id}>
							<div className="split-title">
								<h2>{g.title}</h2>
								<span className="hint">{g.hint}</span>
							</div>
							<div
								className={`ts-card${g.id === "confirmed" ? " swap-confirmed" : ""}`}
							>
								{items.map((c) => swapRow(c, g.id))}
							</div>
						</div>
					)
				})}
			</section>

			<section
				id="calendario"
				ref={refs.calendario}
				className="unified-section"
			>
				<PageTitle
					title="Calendar"
					subtitle="Your availability, confirmed swaps, your matches' proposals and deadlines."
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
