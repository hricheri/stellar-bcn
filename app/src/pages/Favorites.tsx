import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Chat } from "../components/Chat"
import { ProposeDates } from "../components/ProposeDates"
import { ReviewList } from "../components/ReviewList"
import {
	Avatar,
	PageTitle,
	RatingLine,
	TierBadge,
} from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"
import { useProfiles } from "../hooks/useProfiles"
import {
	useArtist,
	useArtists,
	useLikes,
	useReviews,
	useSpots,
} from "../hooks/useTattoo"
import { useAllTrips } from "../hooks/useTrips"
import { useWallet } from "../hooks/useWallet"
import { type Artist, formatRange, type Spot, SPOT_OPEN } from "../lib/tattoo"

// TATTOO APP: the studios I saved. For each one: their free dates, the days
// they want to travel (so I can offer my studio) and their reviews. What
// appeared since my last visit is marked as new.

const SEEN_KEY = "tattoo-favorites-seen"

interface Seen {
	spots: number[]
	reviews: number
	trips: string[]
}

const loadSeen = (): Record<string, Seen> => {
	try {
		return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<
			string,
			Seen
		>
	} catch {
		return {}
	}
}

const unix = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000

const FavoriteRow = ({
	artist,
	me,
	spots,
	trips,
	seen,
	onSeen,
}: {
	artist: Artist
	me: string
	spots: Spot[]
	trips: { start: number; end: number; key: string }[]
	seen?: Seen
	onSeen: (s: Seen) => void
}) => {
	const [open, setOpen] = useState<"dates" | "reviews" | "chat">()
	const reviews = useReviews(open === "reviews" ? artist.address : undefined)
	const free = spots.filter((s) => s.status === SPOT_OPEN)
	const newSpots = seen ? free.filter((s) => !seen.spots.includes(s.id)) : []
	const newTrips = seen ? trips.filter((t) => !seen.trips.includes(t.key)) : []
	const newReviews = seen ? Math.max(0, artist.review_count - seen.reviews) : 0
	const hasNews = newSpots.length + newTrips.length + newReviews > 0

	// Remember what I've seen once this visit is over
	useEffect(
		() => () =>
			onSeen({
				spots: free.map((s) => s.id),
				reviews: artist.review_count,
				trips: trips.map((t) => t.key),
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[free.length, trips.length, artist.review_count],
	)

	const toggle = (t: typeof open) => setOpen(open === t ? undefined : t)

	return (
		<div className="stay-row">
			<div className="stay-main">
				<Link to={`/artista/${artist.address}`}>
					<Avatar artist={artist} big />
				</Link>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className="stay-city">{artist.city}</div>
					<Link to={`/artista/${artist.address}`} className="host-name">
						{artist.name}
					</Link>{" "}
					<TierBadge artist={artist} />
					<div className="meta">
						<RatingLine artist={artist} />
					</div>
				</div>
				{hasNews && <span className="dot-alert" title="New" />}
			</div>

			<div className="chips" style={{ marginTop: "0.6rem" }}>
				{free.length > 0 ? (
					<span className="chip chip-full">
						📅 {free.length} free {free.length === 1 ? "date" : "dates"}
						{newSpots.length > 0 && <b> · {newSpots.length} new</b>}
					</span>
				) : (
					<span className="chip">No free dates</span>
				)}
				{trips.map((t) => (
					<span key={t.key} className="chip chip-trip">
						✈ Wants to travel {formatRange(t.start, t.end)}
						{newTrips.includes(t) && <b> · new</b>}
					</span>
				))}
				{newReviews > 0 && (
					<span className="chip chip-full">
						★ {newReviews} new {newReviews === 1 ? "review" : "reviews"}
					</span>
				)}
			</div>

			<div className="card-actions">
				<button
					className={`btn-ghost${open === "dates" ? " on" : ""}`}
					onClick={() => toggle("dates")}
				>
					📅 Dates
				</button>
				<button
					className={`btn-ghost${open === "reviews" ? " on" : ""}`}
					onClick={() => toggle("reviews")}
				>
					★ Reviews ({artist.review_count})
				</button>
				<button
					className={`btn-ghost${open === "chat" ? " on" : ""}`}
					onClick={() => toggle("chat")}
				>
					💬 Chat
				</button>
			</div>

			{open === "dates" && (
				<div style={{ marginTop: "0.75rem" }}>
					{trips.length > 0 && (
						<p className="hint">
							{artist.name} wants to travel{" "}
							{trips.map((t) => formatRange(t.start, t.end)).join(", ")}. If
							your studio is free then, offer it in the chat.
						</p>
					)}
					<ProposeDates host={artist.address} inline />
				</div>
			)}
			{open === "reviews" && (
				<div style={{ marginTop: "0.75rem" }}>
					{reviews.isLoading ? (
						<div className="hint">Loading...</div>
					) : (
						<ReviewList reviews={reviews.data ?? []} />
					)}
				</div>
			)}
			{open === "chat" && (
				<div style={{ marginTop: "0.75rem" }}>
					<Chat me={me} other={artist} canChat />
				</div>
			)}
		</div>
	)
}

const Favorites = () => {
	const { address } = useWallet()
	const { ready, session } = useAuth()
	const me = useArtist(address)
	const artists = useArtists()
	const likes = useLikes(address)
	const spots = useSpots()
	const profiles = useProfiles()
	const allTrips = useAllTrips()
	const [seen] = useState(loadSeen)

	// Trips by Stellar address
	const tripsOf = useMemo(() => {
		const byUser = new Map(
			[...(profiles.data?.values() ?? [])].map((p) => [
				p.id,
				p.stellar_address,
			]),
		)
		const out = new Map<string, { start: number; end: number; key: string }[]>()
		for (const t of allTrips.data ?? []) {
			const who = byUser.get(t.user_id)
			if (!who) continue
			out.set(who, [
				...(out.get(who) ?? []),
				{
					start: unix(t.start_date),
					end: unix(t.end_date),
					key: `${t.start_date}/${t.end_date}`,
				},
			])
		}
		return out
	}, [profiles.data, allTrips.data])

	if (!address || !me.data)
		return (
			<>
				<PageTitle title="Favorites" />
				<div className="alert alert-info">
					{ready && !session ? (
						<>
							<Link to="/entrar">Sign in</Link> to see your favorites.
						</>
					) : (
						<>
							First <Link to="/perfil">create your profile</Link>.
						</>
					)}
				</div>
			</>
		)

	const liked = new Set(likes.data ?? [])
	const favorites = (artists.data ?? []).filter((a) => liked.has(a.address))
	const saveSeen = (who: string, s: Seen) => {
		const all = loadSeen()
		all[who] = s
		try {
			localStorage.setItem(SEEN_KEY, JSON.stringify(all))
		} catch {
			// Private mode: news just show again next time
		}
	}

	return (
		<>
			<PageTitle
				title="Favorites"
				subtitle="The studios you saved: their new dates, their trips and their reviews."
			/>
			{favorites.length === 0 ? (
				<div className="ts-card empty-state">
					No favorites yet. Tap ♥ on a card in <Link to="/">Explore</Link> to
					save it here.
				</div>
			) : (
				<div className="ts-card">
					{favorites.map((a) => (
						<FavoriteRow
							key={a.address}
							artist={a}
							me={address}
							spots={(spots.data ?? []).filter((s) => s.host === a.address)}
							trips={tripsOf.get(a.address) ?? []}
							seen={seen[a.address]}
							onSeen={(s) => saveSeen(a.address, s)}
						/>
					))}
				</div>
			)}
		</>
	)
}

export default Favorites
