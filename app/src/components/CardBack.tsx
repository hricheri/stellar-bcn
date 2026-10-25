import { Link } from "react-router-dom"
import { useStudioArea } from "../hooks/useStudioPlace"
import {
	useArtists,
	useBookings,
	useReviews,
	useStudios,
} from "../hooks/useTattoo"
import {
	amenityLabel,
	type Artist,
	BK_COMPLETED,
	BK_CONFIRMED,
	formatDate,
	formatRange,
	type MatchResult,
	type Spot,
	type Studio,
	studioAvg,
	type StudioTier,
} from "../lib/tattoo"
import { AreaMap } from "./AreaMap"
import {
	Avatar,
	BasicsBadge,
	RatingLine,
	Stars,
	StudioTierBadge,
	TierBadge,
} from "./TattooUI"

// TATTOO APP: the back of an Explore card. Who they are (bigger photo),
// their best reviews, where the studio is and where they last guested.

/** Their two best reviews that have a comment */
const BestReviews = ({
	artist,
	profile,
}: {
	artist: Artist
	profile: string
}) => {
	const reviews = useReviews(artist.address)
	const artists = useArtists()
	const names = new Map((artists.data ?? []).map((a) => [a.address, a.name]))
	const best = [...(reviews.data ?? [])]
		.filter((r) => r.comment.trim())
		.sort(
			(a, b) => b.score - a.score || Number(b.timestamp) - Number(a.timestamp),
		)
		.slice(0, 2)
	if (reviews.isLoading) return <div className="hint">Loading reviews...</div>
	if (best.length === 0)
		return <div className="hint">No written reviews yet.</div>
	return (
		<Link to={`${profile}?see=reviews`} className="best-reviews">
			{best.map((r, i) => (
				<div key={i} className="best-review">
					<Stars score={r.score} />
					<p>“{r.comment}”</p>
					<span className="hint">— {names.get(r.from) ?? "An artist"}</span>
				</div>
			))}
			<span className="link-more">All reviews →</span>
		</Link>
	)
}

/** Where they did their last guest spot */
const LastGuestSpot = ({ artist }: { artist: Artist }) => {
	const bookings = useBookings(artist.address)
	const studios = useStudios()
	const now = Date.now() / 1000
	const last = (bookings.data ?? [])
		.filter(
			(b) =>
				b.guest === artist.address &&
				(b.status === BK_CONFIRMED || b.status === BK_COMPLETED) &&
				Number(b.start) <= now,
		)
		.sort((a, b) => Number(b.start) - Number(a.start))[0]
	if (!last) return null
	const studio = (studios.data ?? []).find((s) => s.id === last.studio_id)
	return (
		<div className="meta" style={{ marginTop: "0.6rem" }}>
			✈ Last guest spot:{" "}
			<b>{studio ? `${studio.name}, ${studio.city}` : "a studio"}</b> ·{" "}
			{formatDate(last.start)}
		</div>
	)
}

const StudioMap = ({ studio }: { studio: Studio }) => {
	const area = useStudioArea(studio)
	if (!area) return null
	return (
		<>
			<AreaMap lat={area.lat} lng={area.lng} label={`Map of ${area.area}`} />
			<div className="hint" style={{ marginTop: "0.3rem" }}>
				📍 {area.area || studio.city}
				{area.exact
					? " · the exact address comes in the chat once your stay is confirmed"
					: ""}
			</div>
		</>
	)
}

export const CardBack = ({
	artist: a,
	studio,
	tier,
	spots,
	match: m,
	liked,
	signedIn,
	onBack,
}: {
	artist: Artist
	studio?: Studio
	tier?: StudioTier
	spots: Spot[]
	match: MatchResult
	liked: boolean
	signedIn: boolean
	onBack: () => void
}) => {
	const profile = `/artista/${a.address}`
	return (
		<article className="flip-face flip-back ts-card">
			<div className="flip-back-head">
				<button className="btn-ghost" onClick={onBack}>
					← Back
				</button>
				{liked && <span className="pill pill-dark">♥ In favorites</span>}
			</div>
			<div className="flip-back-body">
				<div className="back-who">
					<Link to={profile} aria-label={`${a.name}'s profile`}>
						<Avatar artist={a} xl />
					</Link>
					<div style={{ minWidth: 0 }}>
						<Link to={profile} className="host-name card-name">
							{a.name}
						</Link>
						<div className="meta">{a.instagram}</div>
						<div className="meta">
							<TierBadge artist={a} /> <RatingLine artist={a} />
						</div>
					</div>
				</div>

				{signedIn ? (
					<>
						<div className="section-label">Best reviews</div>
						<BestReviews artist={a} profile={profile} />
						<LastGuestSpot artist={a} />
					</>
				) : (
					<p className="hint">
						<Link to="/entrar">Sign in</Link> to see their reviews and where
						their studio is.
					</p>
				)}

				{studio && (
					<>
						<div className="section-label">The studio</div>
						<div className="meta">
							<b>{studio.name}</b> · ⭐ {studioAvg(studio)} (
							{studio.review_count}{" "}
							{studio.review_count === 1 ? "review" : "reviews"}) ·{" "}
							{studio.members.length}{" "}
							{studio.members.length === 1 ? "artist" : "artists"}
						</div>
						<div className="chips" style={{ margin: "0.35rem 0 0.6rem" }}>
							{tier && <StudioTierBadge tier={tier} />}
							<BasicsBadge spot={studio} />
						</div>
						{signedIn && <StudioMap studio={studio} />}
					</>
				)}

				{spots.length > 0 && (
					<>
						<div className="section-label">Available dates</div>
						<div className="chips">
							{spots.map((s) => (
								<span key={s.id} className="chip chip-has">
									{formatRange(s.start, s.end)}
									{s.kind !== "studio" ? " · + home" : ""}
								</span>
							))}
						</div>
					</>
				)}
				{m.extras.length > 0 && (
					<>
						<div className="section-label has">Extras</div>
						<div className="chips">
							{m.extras.map((id) => (
								<span key={id} className="chip chip-has">
									{amenityLabel(id)}
								</span>
							))}
						</div>
					</>
				)}
			</div>
		</article>
	)
}
