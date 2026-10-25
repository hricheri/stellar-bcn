import { useMemo, useState } from "react"
import { LikeButton } from "../components/LikeButton"
import { ArtistRow, MatchRing, PageTitle } from "../components/TattooUI"
import { useArtists, useSpots } from "../hooks/useTattoo"
import {
	isEstablished,
	loadWishlist,
	matchSpot,
	reputationOf,
	SPOT_OPEN,
} from "../lib/tattoo"

const Artists = () => {
	const artists = useArtists()
	const spots = useSpots()
	const [query, setQuery] = useState("")

	// Match de cada artista = su estudio disponible que mejor encaja con "Lo que busco"
	const results = useMemo(() => {
		const wish = loadWishlist()
		const best = new Map<string, number>()
		for (const s of spots.data ?? []) {
			if (s.status !== SPOT_OPEN) continue
			const p = matchSpot(s, wish).percent
			best.set(s.host, Math.max(best.get(s.host) ?? 0, p))
		}
		const q = query.toLowerCase()
		return (artists.data ?? [])
			.filter(
				(a) =>
					!q ||
					a.name.toLowerCase().includes(q) ||
					a.city.toLowerCase().includes(q),
			)
			.map((artist) => ({ artist, match: best.get(artist.address) }))
			.sort(
				(a, b) =>
					(b.match ?? -1) - (a.match ?? -1) ||
					reputationOf(b.artist).average_x100 -
						reputationOf(a.artist).average_x100,
			)
	}, [artists.data, spots.data, query])

	return (
		<>
			<PageTitle
				title="Artistas"
				subtitle="Ordenadxs por match con lo que buscas. Su reputación vive en Stellar: reseñas de otrxs artistas y de clientes reales, que nadie puede borrar."
			/>
			<div className="field">
				<input
					placeholder="Buscar por nombre o ciudad"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>
			<div className="chips" style={{ marginBottom: "1rem" }}>
				<span className="pill pill-lima">
					★ Establecidx: 3+ reseñas, promedio 4+
				</span>
				<span className="pill pill-lavender">
					✦ Nuevx: construyendo reputación
				</span>
			</div>

			{artists.isLoading && (
				<div className="empty-state">Cargando artistas...</div>
			)}

			{results.map(({ artist, match }) => (
				<div
					className={`ts-card ${isEstablished(artist) ? "tier-established" : "tier-new"}`}
					key={artist.address}
				>
					<div className="ts-card-body">
						<ArtistRow
							artist={artist}
							extra={
								<div
									style={{
										display: "flex",
										gap: "0.5rem",
										alignItems: "center",
									}}
								>
									{match !== undefined ? (
										<MatchRing percent={match} />
									) : (
										<span className="hint">Sin fechas libres</span>
									)}
									<LikeButton artist={artist.address} />
								</div>
							}
						/>
					</div>
				</div>
			))}
		</>
	)
}

export default Artists
