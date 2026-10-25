import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { SpotCard } from "../components/SpotCard"
import { PageTitle } from "../components/TattooUI"
import { WishlistEditor } from "../components/WishlistEditor"
import { useArtist, useArtists, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	loadWishlist,
	matchSpot,
	saveWishlist,
	SPOT_OPEN,
	type Wishlist,
} from "../lib/tattoo"

const Explore = () => {
	const { address } = useWallet()
	const spots = useSpots()
	const artists = useArtists()
	const me = useArtist(address)
	const [wish, setWish] = useState<Wishlist>(loadWishlist)
	const [showForm, setShowForm] = useState(false)
	const [onlyOpen, setOnlyOpen] = useState(true)

	const setAndSave = (next: Wishlist) => {
		setWish(next)
		saveWishlist(next)
	}

	const hosts = useMemo(
		() => new Map((artists.data ?? []).map((a) => [a.address, a])),
		[artists.data],
	)

	const results = useMemo(
		() =>
			(spots.data ?? [])
				.filter((s) => !onlyOpen || s.status === SPOT_OPEN)
				.map((spot) => ({ spot, match: matchSpot(spot, wish) }))
				.sort((a, b) => b.match.percent - a.match.percent),
		[spots.data, wish, onlyOpen],
	)

	return (
		<>
			<PageTitle
				title="Explorar estudios"
				subtitle="Dinos qué buscas y te mostramos los estudios ordenados por match."
			/>

			<section className="ts-card">
				<div className="ts-card-body">
					<div className="split-title" style={{ margin: 0 }}>
						<h2>Lo que busco</h2>
						<button
							className="btn-ghost"
							onClick={() => setShowForm(!showForm)}
						>
							{showForm ? "Ocultar" : "Editar"}
						</button>
					</div>
					{showForm ? (
						<div style={{ marginTop: "0.85rem" }}>
							<WishlistEditor wish={wish} onChange={setAndSave} />
						</div>
					) : (
						<div className="chips" style={{ marginTop: "0.6rem" }}>
							{wish.trips.map((t, i) => (
								<span key={i} className="chip chip-has">
									📍 {t.city || "Cualquier ciudad"}
									{t.from && t.to ? ` · ${t.from} → ${t.to}` : ""}
								</span>
							))}
						</div>
					)}
					<p className="hint" style={{ marginTop: "0.6rem" }}>
						También lo editas en{" "}
						<Link to="/perfil#lo-que-busco">tu perfil</Link>.
					</p>
				</div>
			</section>

			<div className="split-title">
				<h2>
					{results.length} {results.length === 1 ? "estudio" : "estudios"}
				</h2>
				<label className="meta" style={{ display: "flex", gap: "0.35rem" }}>
					<input
						type="checkbox"
						checked={onlyOpen}
						onChange={(e) => setOnlyOpen(e.target.checked)}
					/>
					Solo disponibles
				</label>
			</div>

			{spots.isLoading && (
				<div className="empty-state">Cargando estudios de la blockchain...</div>
			)}
			{spots.error && (
				<div className="alert alert-error">
					No pudimos leer el contrato: {(spots.error as Error).message}
				</div>
			)}
			{!spots.isLoading && results.length === 0 && (
				<div className="ts-card empty-state">
					Todavía no hay estudios publicados. ¡Publica el tuyo!
				</div>
			)}

			{results.map(({ spot, match }) => (
				<SpotCard
					key={spot.id}
					spot={spot}
					match={match}
					host={hosts.get(spot.host)}
					me={me.data}
				/>
			))}
		</>
	)
}

export default Explore
