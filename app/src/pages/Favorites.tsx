import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Chat } from "../components/Chat"
import { ProposeDates } from "../components/ProposeDates"
import { ReviewList } from "../components/ReviewList"
import {
	About,
	Avatar,
	CalendarIcon,
	NameLine,
	PageTitle,
	Photo,
	RatingLine,
} from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"
import { useUnread } from "../hooks/useChat"
import { useLike, useLikedMe, useLikes } from "../hooks/useLikes"
import { useProfiles, useStudioImage } from "../hooks/useProfiles"
import {
	useArtist,
	useArtists,
	useReviews,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useAllTrips, useTravelDays } from "../hooks/useTrips"
import { useWallet } from "../hooks/useWallet"
import {
	type Artist,
	formatRange,
	isEstablished,
	type Spot,
	SPOT_OPEN,
	type Studio,
} from "../lib/tattoo"
import { freeDays, sharedDays } from "../lib/travel"

// TATTOO APP: my favorites as flip cards, like in the Swaps of the hackathon
// version. Front: their studio and what's new (dates, trips, reviews, unread
// messages). Back: the chat, their dates and their reviews.

const SEEN_KEY = "tattoo-favorites-seen"

interface Seen {
	spots: number[]
	reviews: number
	trips: string[]
}

interface TripRange {
	start: number
	end: number
	key: string
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

const saveSeen = (who: string, s: Seen) => {
	const all = loadSeen()
	all[who] = s
	try {
		localStorage.setItem(SEEN_KEY, JSON.stringify(all))
	} catch {
		// Private mode: news just show again next time
	}
}

const unix = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000

type Kind = "match" | "liked" | "likedMe"
type Tab = "chat" | "dates" | "reviews"

const FavoriteCard = ({
	artist: a,
	kind,
	studio,
	spots,
	trips,
	unread,
	canChat,
	seen,
}: {
	artist: Artist
	kind: Kind
	studio?: Studio
	spots: Spot[]
	trips: TripRange[]
	unread: number
	canChat: boolean
	seen?: Seen
}) => {
	const { address } = useWallet()
	const like = useLike()
	const travel = useTravelDays().days
	const image = useStudioImage(studio)
	const [tab, setTab] = useState<Tab>()
	const [likedBack, setLikedBack] = useState(false)
	const reviews = useReviews(tab === "reviews" ? a.address : undefined)
	const profile = `/artista/${a.address}`

	const free = spots.filter((s) => s.status === SPOT_OPEN)
	const newSpots = seen ? free.filter((s) => !seen.spots.includes(s.id)) : []
	const newTrips = seen ? trips.filter((t) => !seen.trips.includes(t.key)) : []
	const newReviews = seen ? Math.max(0, a.review_count - seen.reviews) : 0
	// Their free days that fall on the days I can travel
	const shared = sharedDays(travel, freeDays(spots))

	// What I've seen is remembered once this visit is over
	useEffect(
		() => () =>
			saveSeen(a.address, {
				spots: free.map((s) => s.id),
				reviews: a.review_count,
				trips: trips.map((t) => t.key),
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[free.length, trips.length, a.review_count],
	)

	return (
		<div className={`flip fav-card${tab ? " flipped" : ""}`}>
			<div className="flip-inner">
				{/* Front */}
				<article className="flip-face ts-card">
					<div className="card-photo card-photo-studio fav-photo">
						<Photo
							key={image}
							src={image}
							alt={studio?.name ?? a.name}
							fallback={<div className="cover-fallback" />}
						/>
						<span className="card-city">{studio?.city ?? a.city}</span>
						<button
							className="card-flip card-chat"
							aria-label="Chat"
							title="Chat"
							onClick={() => setTab("chat")}
						>
							💬
							{unread > 0 && <span className="badge">{unread}</span>}
						</button>
						<button
							className="card-flip"
							aria-label="Chat and more"
							onClick={() => setTab("chat")}
						>
							→
						</button>
					</div>
					<div className="ts-card-body">
						<div className="host-row">
							<Link to={profile} aria-label={`${a.name}'s profile`}>
								<Avatar artist={a} big />
							</Link>
							<div style={{ flex: 1, minWidth: 0 }}>
								<NameLine artist={a} to={profile} />
								<About artist={a} studio={studio?.name} />
							</div>
							{shared > 0 && (
								<span
									className="chip chip-trip"
									title="Days on your availability"
								>
									✈️ {shared}
								</span>
							)}
							<button
								className="cal-btn"
								title="Their dates"
								onClick={() => setTab("dates")}
							>
								<CalendarIcon />
								{newSpots.length > 0 && (
									<span className="badge">{newSpots.length}</span>
								)}
							</button>
						</div>

						<div className="chips" style={{ marginTop: "0.6rem" }}>
							{kind === "match" && (
								<span className="pill pill-dark">♥ Match</span>
							)}
							{kind === "likedMe" && !likedBack && (
								<span className="pill pill-outline-dark">♥ Liked you</span>
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

						{kind === "likedMe" && !likedBack && (
							<div className="card-actions">
								<button
									className="btn-lime"
									onClick={() =>
										void like(a.address).then(() => setLikedBack(true))
									}
								>
									♥ Like back
								</button>
							</div>
						)}
					</div>
				</article>

				{/* Back */}
				<article className="flip-face flip-back ts-card">
					<div className="flip-back-head">
						<button className="btn-ghost" onClick={() => setTab(undefined)}>
							← {a.name}
						</button>
						<div className="chips">
							{(["chat", "dates", "reviews"] as const).map((t) => (
								<button
									key={t}
									className={`chip-toggle${tab === t ? " on" : ""}`}
									onClick={() => setTab(t)}
								>
									{t === "chat" ? "Chat" : t === "dates" ? "Dates" : "Reviews"}
								</button>
							))}
						</div>
					</div>
					<div className="flip-back-body">
						{tab === "chat" && address && (
							<Chat me={address} other={a} canChat={canChat} />
						)}
						{tab === "dates" && (
							<>
								{trips.length > 0 && (
									<p className="hint" style={{ marginTop: 0 }}>
										{a.name} wants to travel{" "}
										{trips.map((t) => formatRange(t.start, t.end)).join(", ")}.
										If your studio is free then, offer it in the chat.
									</p>
								)}
								{studio ? (
									<ProposeDates host={a.address} studioId={studio.id} inline />
								) : (
									<p className="hint">They don't have a studio to visit yet.</p>
								)}
							</>
						)}
						{tab === "reviews" &&
							(reviews.isLoading ? (
								<div className="hint">Loading...</div>
							) : (
								<>
									<RatingLine artist={a} />
									<ReviewList reviews={reviews.data ?? []} />
									<Link to={`${profile}?see=reviews`} className="link-more">
										See their full profile →
									</Link>
								</>
							))}
					</div>
				</article>
			</div>
		</div>
	)
}

const Favorites = () => {
	const { address } = useWallet()
	const { ready, session } = useAuth()
	const me = useArtist(address)
	const artists = useArtists()
	const studios = useStudios()
	const likes = useLikes()
	const everyone = useMemo(
		() => (artists.data ?? []).map((a) => a.address),
		[artists.data],
	)
	const likedMe = useLikedMe(everyone)
	const spots = useSpots()
	const profiles = useProfiles()
	const allTrips = useAllTrips()
	const unread = useUnread()
	const [seen] = useState(loadSeen)

	// Trips and unread messages by Stellar address
	const { tripsOf, unreadOf } = useMemo(() => {
		const byUser = new Map(
			[...(profiles.data?.values() ?? [])].map((p) => [
				p.id,
				p.stellar_address,
			]),
		)
		const trips = new Map<string, TripRange[]>()
		for (const t of allTrips.data ?? []) {
			const who = byUser.get(t.user_id)
			if (!who) continue
			trips.set(who, [
				...(trips.get(who) ?? []),
				{
					start: unix(t.start_date),
					end: unix(t.end_date),
					key: `${t.start_date}/${t.end_date}`,
				},
			])
		}
		const counts = new Map<string, number>()
		for (const [id, n] of unread.data ?? []) {
			const who = byUser.get(id)
			if (who) counts.set(who, n)
		}
		return { tripsOf: trips, unreadOf: counts }
	}, [profiles.data, allTrips.data, unread.data])

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
	const theyLiked = likedMe.data ?? new Set<string>()
	const iCanWriteFirst = isEstablished(me.data)
	const kindOf = (a: string): Kind | undefined =>
		liked.has(a) && theyLiked.has(a)
			? "match"
			: liked.has(a)
				? "liked"
				: theyLiked.has(a)
					? "likedMe"
					: undefined

	// Unread messages first, then whoever has news
	const people = (artists.data ?? [])
		.filter((a) => a.address !== address && kindOf(a.address))
		.sort(
			(x, y) => (unreadOf.get(y.address) ?? 0) - (unreadOf.get(x.address) ?? 0),
		)

	const section = (kind: Kind, title: string, hint: string) => {
		const list = people.filter((a) => kindOf(a.address) === kind)
		if (list.length === 0) return null
		return (
			<>
				<div className="split-title">
					<h2>{title}</h2>
					<span className="hint">{hint}</span>
				</div>
				<div className="fav-list">
					{list.map((a) => (
						<FavoriteCard
							key={a.address}
							artist={a}
							kind={kind}
							studio={(studios.data ?? []).find((s) =>
								s.members.includes(a.address),
							)}
							spots={(spots.data ?? []).filter((s) => s.host === a.address)}
							trips={tripsOf.get(a.address) ?? []}
							unread={unreadOf.get(a.address) ?? 0}
							canChat={kind === "match" || iCanWriteFirst}
							seen={seen[a.address]}
						/>
					))}
				</div>
			</>
		)
	}

	return (
		<>
			<PageTitle
				title="Favorites"
				subtitle="Your saved studios. Tap → or Chat to flip a card."
			/>
			{people.length === 0 && (
				<div className="ts-card empty-state">
					No favorites yet. Tap ♥ on a card in <Link to="/">Explore</Link> to
					save it here.
				</div>
			)}
			{section("match", "♥ Matches", "You liked each other: chat is open")}
			{section("liked", "♡ My favorites", "New dates, trips and reviews")}
			{section("likedMe", "They liked you", "Like them back to match")}
		</>
	)
}

export default Favorites
