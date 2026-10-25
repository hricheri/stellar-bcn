import { useMemo, useState } from "react"
import { AmenityPicker } from "../components/AmenityPicker"
import { SpotCard } from "../components/SpotCard"
import { PageTitle } from "../components/TattooUI"
import { useArtist, useArtists, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	isEstablished,
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
	const [showForm, setShowForm] = useState(true)
	const [onlyOpen, setOnlyOpen] = useState(true)

	const update = (patch: Partial<Wishlist>) => {
		const next = { ...wish, ...patch }
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

	// Igual que en Artistas: estudios de hosts establecidxs y de hosts nuevxs
	const [established, newcomers] = useMemo(() => {
		const isEst = (s: (typeof results)[number]) => {
			const host = hosts.get(s.spot.host)
			return host ? isEstablished(host) : false
		}
		return [results.filter(isEst), results.filter((r) => !isEst(r))]
	}, [results, hosts])

	const renderSpots = (list: typeof results) =>
		list.map(({ spot, match }) => (
			<SpotCard
				key={spot.id}
				spot={spot}
				match={match}
				host={hosts.get(spot.host)}
				me={me.data}
			/>
		))

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
					{showForm && (
						<div style={{ marginTop: "0.85rem" }}>
							<div className="field-row">
								<div className="field" style={{ minWidth: 180 }}>
									<label htmlFor="city">Ciudad</label>
									<input
										id="city"
										placeholder="Berlín, Lisboa..."
										value={wish.city}
										onChange={(e) => update({ city: e.target.value })}
									/>
								</div>
								<div className="field">
									<label htmlFor="from">Desde</label>
									<input
										id="from"
										type="date"
										value={wish.from}
										onChange={(e) => update({ from: e.target.value })}
									/>
								</div>
								<div className="field">
									<label htmlFor="to">Hasta</label>
									<input
										id="to"
										type="date"
										value={wish.to}
										onChange={(e) => update({ to: e.target.value })}
									/>
								</div>
							</div>
							<AmenityPicker
								selected={wish.wanted}
								onChange={(wanted) => update({ wanted })}
							/>
							<p className="hint" style={{ marginTop: "0.85rem" }}>
								Match = ciudad (35%) + fechas que se solapan con tu viaje (35%)
								+ equipamiento e insumos que buscas (30%).
							</p>
						</div>
					)}
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

			{established.length > 0 && (
				<>
					<div className="split-title">
						<h2>★ Estudios establecidos</h2>
						<span className="hint">Host con 3+ reseñas, promedio 4 o más</span>
					</div>
					{renderSpots(established)}
				</>
			)}
			{newcomers.length > 0 && (
				<>
					<div className="split-title">
						<h2>✦ Estudios nuevos</h2>
						<span className="hint">
							Su host está construyendo su reputación
						</span>
					</div>
					{renderSpots(newcomers)}
				</>
			)}
		</>
	)
}

export default Explore
