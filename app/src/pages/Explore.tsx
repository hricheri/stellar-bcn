import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { AmenityPicker } from "../components/AmenityPicker"
import { type Candidate, ExploreCard } from "../components/ExploreCard"
import { PageTitle } from "../components/TattooUI"
import {
	useArtist,
	useArtists,
	useLikes,
	useSend,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	isEstablished,
	loadWishlist,
	matchTrip,
	NO_STUDIO,
	saveWishlist,
	SPOT_OPEN,
	studioTier,
	type Trip,
} from "../lib/tattoo"

// TATTOO APP: Explorar como en el Sprint 4. 1) dónde, cuándo y qué materiales
// 2) tarjetas de a una, ordenadas por match 3) like = favoritos 4) reservar fechas

interface Search {
	trip: Trip
	wanted: string[]
}

const DISMISSED_KEY = "tattoo-dismissed"

const loadDismissed = (): string[] => {
	try {
		return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[]
	} catch {
		return []
	}
}

const saveDismissed = (list: string[]) => {
	try {
		sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(list))
	} catch {
		// no storage: only for this visit
	}
}

const Explore = () => {
	const { address } = useWallet()
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const me = useArtist(address)
	const likes = useLikes(address)
	const send = useSend()

	const saved = useMemo(loadWishlist, [])
	const [search, setSearch] = useState<Search>(() => ({
		trip: saved.trips[0] ?? { city: "", from: "", to: "" },
		wanted: saved.wanted,
	}))
	const [showSupplies, setShowSupplies] = useState(false)
	const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
	const [justLiked, setJustLiked] = useState<string[]>([])
	const [notice, setNotice] = useState<React.ReactNode>()

	const update = (next: Search) => {
		setSearch(next)
		// The first trip of "Lo que busco" is what Explore searches
		saveWishlist({
			trips: [next.trip, ...saved.trips.slice(1)],
			wanted: next.wanted,
		})
	}
	const setTrip = (patch: Partial<Trip>) =>
		update({ ...search, trip: { ...search.trip, ...patch } })

	const cities = useMemo(
		() =>
			[...new Set((studios.data ?? []).map((s) => s.city))].sort((a, b) =>
				a.localeCompare(b),
			),
		[studios.data],
	)

	const candidates = useMemo<Candidate[]>(() => {
		const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
		const allStudios = studios.data ?? []
		const open = (spots.data ?? []).filter((s) => s.status === SPOT_OPEN)
		const out: Candidate[] = []
		for (const artist of artists.data ?? []) {
			if (artist.address === address) continue
			const theirStudios = allStudios.filter((s) =>
				s.members.includes(artist.address),
			)
			const ids = new Set(theirStudios.map((s) => s.id))
			const theirSpots = open.filter((s) =>
				s.studio_id === NO_STUDIO
					? s.host === artist.address
					: ids.has(s.studio_id),
			)
			if (theirStudios.length === 0 && theirSpots.length === 0) continue

			// Best option: one of their open dates, or a studio with no dates yet
			const options = [
				...theirSpots.map((s) => ({
					studioId: s.studio_id,
					match: matchTrip(s, search.trip, search.wanted),
				})),
				...theirStudios.map((st) => ({
					studioId: st.id,
					match: matchTrip(
						{ city: st.city, amenities: st.amenities, start: 0n, end: 0n },
						search.trip,
						search.wanted,
					),
				})),
			]
			const best = options.reduce((x, y) =>
				y.match.percent > x.match.percent ? y : x,
			)
			const studio =
				allStudios.find((s) => s.id === best.studioId) ?? theirStudios[0]
			out.push({
				artist,
				studio,
				tier: studio ? studioTier(studio, byAddress) : undefined,
				spots: theirSpots.sort((x, y) => Number(x.start) - Number(y.start)),
				offersHome: theirSpots.some(
					(s) => s.host === artist.address && s.kind !== "studio",
				),
				match: best.match,
			})
		}
		return out.sort(
			(x, y) =>
				y.match.percent - x.match.percent ||
				Number(isEstablished(y.artist)) - Number(isEstablished(x.artist)),
		)
	}, [artists.data, studios.data, spots.data, address, search])

	const liked = new Set([...(likes.data ?? []), ...justLiked])
	const deck = candidates.filter(
		(c) =>
			!liked.has(c.artist.address) && !dismissed.includes(c.artist.address),
	)
	const current = deck[0]

	const nope = () => {
		if (!current) return
		const next = [...dismissed, current.artist.address]
		setDismissed(next)
		saveDismissed(next)
		setNotice(undefined)
	}

	const like = async () => {
		if (!current) return
		if (!address) {
			setNotice("Toca «Entrar» arriba para guardar favoritos.")
			return
		}
		if (!me.data) {
			setNotice(
				<>
					Primero <Link to="/perfil">crea tu perfil</Link> para dar likes.
				</>,
			)
			return
		}
		const who = current.artist
		setJustLiked((l) => [...l, who.address])
		setNotice(`♥ ${who.name} quedó en tus favoritos.`)
		try {
			const { value } = await send((c, from, o) =>
				c.like_artist({ from, to: who.address }, o),
			)
			if (value)
				setNotice(
					<>
						¡Match con {who.name}! Ya pueden escribirse desde{" "}
						<Link to="/favoritos">Favoritos</Link>.
					</>,
				)
		} catch (e) {
			setJustLiked((l) => l.filter((x) => x !== who.address))
			setNotice((e as Error).message)
		}
	}

	const loading = artists.isLoading || studios.isLoading || spots.isLoading
	const error = artists.error ?? studios.error ?? spots.error

	return (
		<>
			<PageTitle
				title="Explorar"
				subtitle="¿A dónde quieres ir y cuándo? Te mostramos artistas y estudios ordenados por match."
			/>

			<section className="ts-card search-card">
				<div className="ts-card-body">
					<div className="field-grid">
						<label className="span-2">
							Ciudad
							<input
								list="explore-cities"
								placeholder="Cualquier ciudad"
								value={search.trip.city}
								onChange={(e) => setTrip({ city: e.target.value })}
							/>
							<datalist id="explore-cities">
								{cities.map((c) => (
									<option key={c} value={c} />
								))}
							</datalist>
						</label>
						<label>
							Desde
							<input
								type="date"
								value={search.trip.from}
								onChange={(e) => setTrip({ from: e.target.value })}
							/>
						</label>
						<label>
							Hasta
							<input
								type="date"
								value={search.trip.to}
								min={search.trip.from}
								onChange={(e) => setTrip({ to: e.target.value })}
							/>
						</label>
					</div>
					<div className="split-title" style={{ margin: "0.75rem 0 0" }}>
						<span className="meta">
							Necesito <b>{search.wanted.length}</b> materiales del estudio
						</span>
						<button
							className="btn-ghost"
							onClick={() => setShowSupplies(!showSupplies)}
						>
							{showSupplies ? "Listo" : "Elegir materiales"}
						</button>
					</div>
					{showSupplies && (
						<div style={{ marginTop: "0.6rem" }}>
							<AmenityPicker
								selected={search.wanted}
								onChange={(wanted) => update({ ...search, wanted })}
							/>
						</div>
					)}
					{(search.trip.city || search.trip.from) && (
						<button
							className="btn-ghost"
							style={{ marginTop: "0.6rem" }}
							onClick={() => setTrip({ city: "", from: "", to: "" })}
						>
							Limpiar búsqueda
						</button>
					)}
				</div>
			</section>

			<div className="legend" style={{ margin: "0 0 1rem" }}>
				<span className="pill pill-lima">ESTUDIO</span>
				<span className="pill pill-lavender">HOGAR</span>
				<span className="pill pill-dark">★ Establecidx</span>
				<span className="pill pill-outline">✦ Nuevx</span>
				<span className="chip chip-has">Tiene</span>
				<span className="chip chip-missing">Falta</span>
			</div>

			{loading && (
				<div className="empty-state">Cargando artistas de la blockchain...</div>
			)}
			{error && (
				<div className="alert alert-error">
					No pudimos leer el contrato: {(error as Error).message}
				</div>
			)}

			{!loading && !error && (
				<div className="deck">
					{current ? (
						<>
							<ExploreCard
								key={current.artist.address}
								c={current}
								me={me.data}
								onLike={() => void like()}
								onNope={nope}
							/>
							<div className="deck-actions">
								<button className="btn-ghost" onClick={nope}>
									✕ Descartar
								</button>
								<button className="btn-lime" onClick={() => void like()}>
									♥ Like
								</button>
							</div>
							<p className="hint deck-count">
								{candidates.length - deck.length + 1} de {candidates.length} ·
								desliza la tarjeta o usa los botones
							</p>
						</>
					) : (
						<div className="ts-card empty-state">
							{candidates.length === 0
								? "Todavía no hay estudios publicados."
								: "Ya viste todas las tarjetas."}
							{dismissed.length > 0 && (
								<div style={{ marginTop: "0.75rem" }}>
									<button
										className="btn-ghost"
										onClick={() => {
											setDismissed([])
											saveDismissed([])
										}}
									>
										Volver a ver las descartadas
									</button>
								</div>
							)}
						</div>
					)}
					{notice && (
						<div className="alert alert-ok" style={{ marginTop: "0.75rem" }}>
							{notice}
						</div>
					)}
				</div>
			)}
		</>
	)
}

export default Explore
