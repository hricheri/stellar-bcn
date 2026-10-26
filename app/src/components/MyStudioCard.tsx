import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useStudioImage } from "../hooks/useProfiles"
import { useArtists, useStudios } from "../hooks/useTattoo"
import { amenityLabel, type Studio, studioAvg, studioTier } from "../lib/tattoo"
import { StudioDates } from "./StudioDates"
import { Photo, StudioTierBadge } from "./TattooUI"

// TATTOO APP: top of the Studio menu. My studio at a glance with an Edit
// button and its free days, or an invitation to create one. With no studio
// there are no free days to mark.

const Preview = ({
	studio,
	onDates,
}: {
	studio: Studio
	onDates: () => void
}) => {
	const image = useStudioImage(studio)
	const artists = useArtists()
	const byAddress = useMemo(
		() => new Map((artists.data ?? []).map((a) => [a.address, a])),
		[artists.data],
	)
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
				<div className="split-title" style={{ margin: 0 }}>
					<h2 style={{ margin: 0 }}>{studio.name}</h2>
					<StudioTierBadge tier={studioTier(studio, byAddress)} />
				</div>
				<div className="meta">
					⭐ {studioAvg(studio)} ({studio.review_count}{" "}
					{studio.review_count === 1 ? "review" : "reviews"}) ·{" "}
					{studio.members.length}{" "}
					{studio.members.length === 1 ? "artist" : "artists"}
				</div>
				<div className="chips" style={{ margin: "0.5rem 0 0.85rem" }}>
					{studio.amenities.slice(0, 8).map((a) => (
						<span key={a} className="chip chip-has">
							{amenityLabel(a)}
						</span>
					))}
					{studio.amenities.length > 8 && (
						<span className="chip">+{studio.amenities.length - 8}</span>
					)}
				</div>
				<div className="field-row">
					<Link to="/perfil#mi-estudio" className="btn-ghost">
						✎ Edit studio
					</Link>
					<button className="btn-lime" onClick={onDates}>
						📅 Add availability
					</button>
				</div>
			</div>
		</section>
	)
}

export const MyStudioCard = ({ me }: { me: string }) => {
	const studios = useStudios()
	const [params] = useSearchParams()
	// "Add availability" from the profile lands here with ?dates
	const [dates, setDates] = useState(params.has("dates"))
	const loaded = !!studios.data
	useEffect(() => {
		if (loaded && params.has("dates"))
			document.getElementById("fechas")?.scrollIntoView({ behavior: "smooth" })
	}, [loaded, params])
	if (!studios.data) return null
	const mine = studios.data.filter((s) => s.members.includes(me))
	if (mine.length === 0)
		return (
			<section className="ts-card">
				<div className="ts-card-body">
					<p style={{ marginTop: 0, fontWeight: 700 }}>
						Want to share your studio with the community? Create it here so
						other artists can find it!
					</p>
					<Link to="/perfil?create#mi-estudio" className="btn-lime">
						+ Create my studio
					</Link>
				</div>
			</section>
		)
	return (
		<>
			{mine.map((s) => (
				<Preview
					key={s.id}
					studio={s}
					onDates={() => {
						setDates(true)
						setTimeout(() =>
							document
								.getElementById("fechas")
								?.scrollIntoView({ behavior: "smooth" }),
						)
					}}
				/>
			))}
			{dates && (
				<>
					<div className="split-title">
						<h2>📅 Studio availability</h2>
						<button className="btn-ghost" onClick={() => setDates(false)}>
							Close
						</button>
					</div>
					<StudioDates studios={mine} />
				</>
			)}
		</>
	)
}
