import { useParams } from "react-router-dom"
import { Chat } from "../components/Chat"
import { LikeButton } from "../components/LikeButton"
import { ProposeDates } from "../components/ProposeDates"
import { ReviewList } from "../components/ReviewList"
import { SpotCard } from "../components/SpotCard"
import {
	Avatar,
	HomeSwapProgress,
	RatingLine,
	TierBadge,
} from "../components/TattooUI"
import { useArtist, useReviews, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { isEstablished, SPOT_OPEN } from "../lib/tattoo"

const ArtistPage = () => {
	const { address: artistAddress } = useParams()
	const { address } = useWallet()
	const artist = useArtist(artistAddress)
	const me = useArtist(address)
	const reviews = useReviews(artistAddress)
	const spots = useSpots()

	if (artist.isLoading) return <div className="empty-state">Cargando...</div>
	if (!artist.data)
		return <div className="empty-state">Este artista no existe.</div>

	const a = artist.data
	const openSpots = (spots.data ?? []).filter(
		(s) => s.host === a.address && s.status === SPOT_OPEN,
	)

	return (
		<>
			<section className="ts-card">
				<div className="ts-card-body">
					<div className="host-row">
						<Avatar artist={a} big />
						<div>
							<h1 style={{ fontSize: "1.8rem" }}>{a.name}</h1>
							<div
								className="meta"
								style={{ color: "var(--lavender-700)", fontWeight: 700 }}
							>
								{a.city} · {a.instagram}
							</div>
							<div
								style={{
									display: "flex",
									gap: "0.5rem",
									alignItems: "center",
									marginTop: "0.25rem",
								}}
							>
								<TierBadge artist={a} />
								<RatingLine artist={a} />
							</div>
						</div>
						<div style={{ marginLeft: "auto" }}>
							<LikeButton artist={a.address} />
						</div>
					</div>
					<div style={{ marginTop: "1rem" }}>
						<HomeSwapProgress artist={a} />
					</div>
				</div>
			</section>

			{openSpots.length > 0 && (
				<>
					<div className="split-title">
						<h2>Su estudio disponible</h2>
					</div>
					{openSpots.map((s) => (
						<SpotCard key={s.id} spot={s} host={a} me={me.data} />
					))}
				</>
			)}

			{me.data && address && address !== a.address && (
				<section className="ts-card">
					<div className="ts-card-body">
						<ProposeDates host={a.address} />
					</div>
				</section>
			)}

			{me.data &&
				address &&
				address !== a.address &&
				isEstablished(me.data) && (
					<>
						<div className="split-title">
							<h2>Escribirle</h2>
							<span className="hint">
								Como establecidx puedes contactar sin match
							</span>
						</div>
						<section className="ts-card">
							<div className="ts-card-body">
								<Chat me={address} other={a} canChat />
							</div>
						</section>
					</>
				)}

			<div className="split-title">
				<h2>Reseñas on-chain</h2>
				<span className="hint">{reviews.data?.length ?? 0} en total</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<ReviewList reviews={reviews.data ?? []} />
				</div>
			</section>
		</>
	)
}

export default ArtistPage
