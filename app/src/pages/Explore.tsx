import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
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
	type MatchResult,
	matchSpot,
	NO_STUDIO,
	SPOT_OPEN,
	studioTier,
	type Wishlist,
} from "../lib/tattoo"

// TATTOO APP: Explorar como en el Sprint 4. "Lo que busco" (ciudades, fechas y
// materiales) se edita en el perfil; aquí un botón filtra las tarjetas con eso.
// Tarjetas de a una, ordenadas por match. Like = favoritos. Reservar fechas.

const DISMISSED_KEY = "tattoo-dismissed"
const FILTER_KEY = "tattoo-explore-filter"

/** Matches at least the city or the dates of one of my trips */
const fitsMyTrips = (m: MatchResult) =>
	(!!m.trip.city && m.cityOk) ||
	(!!m.trip.from && !!m.trip.to && m.dateOverlap > 0)

const hasTrips = (w: Wishlist) =>
	w.trips.some((t) => t.city || (t.from && t.to))

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

	const wish = useMemo(loadWishlist, [])
	const [filtered, setFiltered] = useState(() => {
		try {
			return localStorage.getItem(FILTER_KEY) !== "off"
		} catch {
			return true
		}
	})
	const toggleFilter = () => {
		setFiltered(!filtered)
		try {
			localStorage.setItem(FILTER_KEY, filtered ? "off" : "on")
		} catch {
			// no storage
		}
	}
	const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
	const [justLiked, setJustLiked] = useState<string[]>([])
	const [notice, setNotice] = useState<React.ReactNode>()
	const canFilter = hasTrips(wish)

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
					match: matchSpot(s, wish),
				})),
				...theirStudios.map((st) => ({
					studioId: st.id,
					match: matchSpot(
						{ city: st.city, amenities: st.amenities, start: 0n, end: 0n },
						wish,
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
	}, [artists.data, studios.data, spots.data, address, wish])

	const liked = new Set([...(likes.data ?? []), ...justLiked])
	const shown = candidates.filter(
		(c) => !filtered || !canFilter || fitsMyTrips(c.match),
	)
	const deck = shown.filter(
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
				subtitle="Artistas y sus estudios, ordenados por match con lo que buscas."
			/>

			<div className="explore-filter">
				<button
					className={filtered && canFilter ? "btn-primary" : "btn-ghost"}
					onClick={toggleFilter}
					disabled={!canFilter}
				>
					{filtered && canFilter
						? "✓ Filtrado por lo que busco"
						: "Filtrar por lo que busco"}
				</button>
				<div className="chips">
					{wish.trips
						.filter((t) => t.city || (t.from && t.to))
						.map((t, i) => (
							<span key={i} className="pill pill-gray">
								📍 {t.city || "Cualquier ciudad"}
								{t.from && t.to
									? ` · ${t.from.slice(5)} → ${t.to.slice(5)}`
									: ""}
							</span>
						))}
					<Link to="/perfil#lo-que-busco" className="hint">
						{canFilter
							? "Editar en mi perfil"
							: "Dinos a dónde quieres ir, en tu perfil →"}
					</Link>
				</div>
			</div>

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
								{shown.length - deck.length + 1} de {shown.length} · desliza la
								tarjeta o usa los botones
							</p>
						</>
					) : (
						<div className="ts-card empty-state">
							{candidates.length === 0
								? "Todavía no hay estudios publicados."
								: shown.length === 0
									? "Nadie coincide con tus ciudades o fechas. Quita el filtro para ver a todxs."
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
