import { Link } from "react-router-dom"
import { useProfileOf } from "../hooks/useProfiles"
import { useStudioArea } from "../hooks/useStudioPlace"
import { useArtists, useReviews } from "../hooks/useTattoo"
import {
	amenityLabel,
	type Artist,
	isEstablished,
	type MatchResult,
	missingBasics,
	type Studio,
} from "../lib/tattoo"
import { AreaMap } from "./AreaMap"
import { Avatar, NameLine, Stars } from "./TattooUI"

// TATTOO APP: the back of an Explore card. Who they are (bigger photo),
// their best review and where the studio is, more or less. The rest
// (studio, dates) is already on the front.

/** Their best written review; the newest one if several tie */
const BestReview = ({
	artist,
	profile,
}: {
	artist: Artist
	profile: string
}) => {
	const reviews = useReviews(artist.address)
	const artists = useArtists()
	const best = [...(reviews.data ?? [])]
		.filter((r) => r.comment.trim())
		.sort(
			(a, b) => b.score - a.score || Number(b.timestamp) - Number(a.timestamp),
		)[0]
	if (!best) return null
	const from = artists.data?.find((a) => a.address === best.from)?.name
	return (
		<>
			<div className="section-label">Best review</div>
			<Link to={`${profile}?see=reviews`} className="best-reviews">
				<div className="best-review">
					<Stars score={best.score} />
					<p>“{best.comment}”</p>
					<span className="hint">— {from ?? "An artist"}</span>
				</div>
				<span className="link-more">All reviews →</span>
			</Link>
		</>
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
	match: m,
	liked,
	signedIn,
	offersHome,
	onBack,
}: {
	artist: Artist
	studio?: Studio
	match: MatchResult
	liked: boolean
	signedIn: boolean
	offersHome: boolean
	onBack: () => void
}) => {
	const profile = `/artista/${a.address}`
	const home = useProfileOf(a.address)
	const missing = studio ? missingBasics(studio) : []
	return (
		<article className="flip-face flip-back ts-card">
			<div className="flip-back-head">
				<button className="btn-ghost" onClick={onBack}>
					← Back
				</button>
				{liked && (
					<span className="back-heart" title="In my favorites">
						♥
					</span>
				)}
			</div>
			<div className="flip-back-body">
				<div className="back-who">
					<Link to={profile} aria-label={`${a.name}'s profile`}>
						<Avatar artist={a} xl />
					</Link>
					<div style={{ minWidth: 0 }}>
						<NameLine artist={a} to={profile} />
						<div className="meta">{a.instagram}</div>
					</div>
				</div>

				{signedIn ? (
					<>
						{isEstablished(a) && <BestReview artist={a} profile={profile} />}
						{studio && (
							<>
								<div className="section-label">Where</div>
								<StudioMap studio={studio} />
							</>
						)}
					</>
				) : (
					<p className="hint">
						<Link to="/entrar">Sign in</Link> to see their reviews and where
						their studio is.
					</p>
				)}

				{signedIn && home?.home_description && offersHome && (
					<>
						<div className="section-label">The home</div>
						<p className="pre" style={{ marginTop: 0 }}>
							{home.home_description}
						</p>
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
				{missing.length > 0 && (
					<>
						<div className="section-label missing">Missing</div>
						<div className="chips">
							{missing.map((id) => (
								<span key={id} className="chip chip-missing">
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
