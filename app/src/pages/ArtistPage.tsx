import { useEffect, useRef } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { AreaMap } from "../components/AreaMap"
import { Chat } from "../components/Chat"
import { LikeButton } from "../components/LikeButton"
import { ProposeDates } from "../components/ProposeDates"
import { ReviewList } from "../components/ReviewList"
import { SpotCard } from "../components/SpotCard"
import {
	Avatar,
	BasicsBadge,
	NameLine,
	Photo,
	Stars,
} from "../components/TattooUI"
import { useProfileOf, useStudioImage } from "../hooks/useProfiles"
import { useStudioArea } from "../hooks/useStudioPlace"
import {
	useArtist,
	useReviews,
	useReviewsBy,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	amenityLabel,
	formatDate,
	isEstablished,
	reputationOf,
	type Studio,
	studioAvg,
	SPOT_OPEN,
} from "../lib/tattoo"

// TATTOO APP: another artist's full profile (members only): who they are,
// their studio and where it is, their dates, the reviews they got and the
// ones they wrote.

const StudioSection = ({ studio }: { studio: Studio }) => {
	const image = useStudioImage(studio)
	const area = useStudioArea(studio)
	return (
		<section className="ts-card">
			<div className="card-photo card-photo-studio">
				<Photo
					key={image}
					src={image}
					alt={studio.name}
					fallback={<div className="cover-fallback" />}
				/>
				<span className="card-city">{studio.city}</span>
			</div>
			<div className="ts-card-body">
				<h2 style={{ margin: 0 }}>{studio.name}</h2>
				<div className="meta">
					⭐ {studioAvg(studio)} ({studio.review_count}{" "}
					{studio.review_count === 1 ? "review" : "reviews"} of the studio)
				</div>
				<div className="chips" style={{ margin: "0.5rem 0" }}>
					<BasicsBadge spot={studio} />
					{studio.amenities.map((a) => (
						<span key={a} className="chip chip-has">
							{amenityLabel(a)}
						</span>
					))}
				</div>
				{area && (
					<>
						<AreaMap
							lat={area.lat}
							lng={area.lng}
							label={`Map of ${area.area}`}
						/>
						<div className="hint" style={{ marginTop: "0.3rem" }}>
							📍 {area.area || studio.city} · the exact address comes in the
							chat once your stay is confirmed
						</div>
					</>
				)}
			</div>
		</section>
	)
}

const ArtistPage = () => {
	const { address: artistAddress } = useParams()
	const [params] = useSearchParams()
	const { address } = useWallet()
	const artist = useArtist(artistAddress)
	const me = useArtist(address)
	const profile = useProfileOf(artistAddress)
	const reviews = useReviews(artistAddress)
	const written = useReviewsBy(artistAddress)
	const spots = useSpots()
	const studios = useStudios()
	const reviewsRef = useRef<HTMLDivElement>(null)

	// "All reviews →" from a card lands on the reviews
	useEffect(() => {
		if (params.get("see") === "reviews" && artist.data)
			reviewsRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [params, artist.data])

	if (artist.isLoading) return <div className="empty-state">Loading...</div>
	if (!artist.data)
		return <div className="empty-state">This artist doesn't exist.</div>

	const a = artist.data
	const isMe = address === a.address
	const openSpots = (spots.data ?? []).filter(
		(s) => s.host === a.address && s.status === SPOT_OPEN,
	)
	const theirStudios = (studios.data ?? []).filter((s) =>
		s.members.includes(a.address),
	)

	return (
		<>
			<section className="ts-card">
				<div className="ts-card-body">
					<div className="host-row">
						<Avatar artist={a} xl />
						<div style={{ minWidth: 0 }}>
							<NameLine artist={a} big />
							<div
								className="meta"
								style={{ color: "var(--lavender-700)", fontWeight: 700 }}
							>
								{a.city} · {a.instagram}
							</div>
						</div>
						{!isMe && (
							<div style={{ marginLeft: "auto" }}>
								<LikeButton artist={a.address} />
							</div>
						)}
					</div>
					{profile?.bio && (
						<p style={{ margin: "0.85rem 0 0" }}>{profile.bio}</p>
					)}
					{reputationOf(a).home_swap_unlocked && profile?.home_description && (
						<div className="chips" style={{ marginTop: "0.6rem" }}>
							<span className="pill pill-lavender">
								🏠 Can host at home too
							</span>
						</div>
					)}
					{reputationOf(a).home_swap_unlocked && profile?.home_description && (
						<p className="hint pre" style={{ marginTop: "0.5rem" }}>
							🏠 {profile.home_description}
						</p>
					)}
				</div>
			</section>

			{theirStudios.map((s) => (
				<StudioSection key={s.id} studio={s} />
			))}

			{openSpots.length > 0 && (
				<>
					<div className="split-title">
						<h2>Available dates</h2>
					</div>
					{openSpots.map((s) => (
						<SpotCard key={s.id} spot={s} host={a} me={me.data} />
					))}
				</>
			)}

			{me.data && !isMe && theirStudios.length > 0 && (
				<section className="ts-card">
					<div className="ts-card-body">
						<ProposeDates host={a.address} />
					</div>
				</section>
			)}

			{me.data && address && !isMe && isEstablished(me.data) && (
				<>
					<div className="split-title">
						<h2>Write to them</h2>
						<span className="hint">
							As an established artist you can write without a match
						</span>
					</div>
					<section className="ts-card">
						<div className="ts-card-body">
							<Chat me={address} other={a} canChat />
						</div>
					</section>
				</>
			)}

			<div className="split-title" ref={reviewsRef}>
				<h2>Reviews they got</h2>
				<span className="hint">{reviews.data?.length ?? 0} in total</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<ReviewList reviews={reviews.data ?? []} />
				</div>
			</section>

			<div className="split-title">
				<h2>Reviews they wrote</h2>
				<span className="hint">{written.data?.length ?? 0} in total</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					{written.isLoading ? (
						<div className="hint">Loading...</div>
					) : (written.data ?? []).length === 0 ? (
						<div className="empty-state">No reviews written yet.</div>
					) : (
						written.data!.map(({ review: r, about, studio }, i) => (
							<div className="review" key={i}>
								<div className="split-title" style={{ margin: 0 }}>
									<Stars score={r.score} />
									<span
										className={`pill ${studio ? "pill-lima" : "pill-lavender"}`}
									>
										{studio ? "Studio" : "Artist"}
									</span>
								</div>
								{r.comment && (
									<p style={{ margin: "0.35rem 0" }}>“{r.comment}”</p>
								)}
								<div className="hint">
									About {about} · {formatDate(r.timestamp)}
								</div>
							</div>
						))
					)}
				</div>
			</section>
		</>
	)
}

export default ArtistPage
