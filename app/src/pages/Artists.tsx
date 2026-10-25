import { useMemo, useState } from "react"
import { LikeButton } from "../components/LikeButton"
import { ArtistRow, PageTitle } from "../components/TattooUI"
import { useArtists } from "../hooks/useTattoo"
import { type Artist, isEstablished, reputationOf } from "../lib/tattoo"

const byReputation = (a: Artist, b: Artist) =>
	reputationOf(b).average_x100 * 10 +
	b.review_count -
	(reputationOf(a).average_x100 * 10 + a.review_count)

const Artists = () => {
	const artists = useArtists()
	const [query, setQuery] = useState("")

	const [established, newcomers] = useMemo(() => {
		const q = query.toLowerCase()
		const list = (artists.data ?? []).filter(
			(a) =>
				!q ||
				a.name.toLowerCase().includes(q) ||
				a.city.toLowerCase().includes(q),
		)
		return [
			list.filter(isEstablished).sort(byReputation),
			list.filter((a) => !isEstablished(a)).sort(byReputation),
		]
	}, [artists.data, query])

	return (
		<>
			<PageTitle
				title="Artistas"
				subtitle="Su reputación vive en Stellar: reseñas de otrxs artistas y de clientes reales, que nadie puede borrar."
			/>
			<div className="field">
				<input
					placeholder="Buscar por nombre o ciudad"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			{artists.isLoading && <div className="empty-state">Cargando artistas...</div>}

			<div className="split-title">
				<h2>★ Establecidxs</h2>
				<span className="hint">3+ reseñas, promedio 4 o más</span>
			</div>
			{established.length === 0 && !artists.isLoading && (
				<div className="ts-card empty-state">Todavía nadie llegó a este nivel.</div>
			)}
			{established.map((a) => (
				<div className="ts-card" key={a.address}>
					<div className="ts-card-body">
						<ArtistRow artist={a} extra={<LikeButton artist={a.address} />} />
					</div>
				</div>
			))}

			<div className="split-title">
				<h2>✦ Nuevxs</h2>
				<span className="hint">Construyendo su reputación</span>
			</div>
			{newcomers.map((a) => (
				<div className="ts-card" key={a.address}>
					<div className="ts-card-body">
						<ArtistRow artist={a} extra={<LikeButton artist={a.address} />} />
					</div>
				</div>
			))}
		</>
	)
}

export default Artists
