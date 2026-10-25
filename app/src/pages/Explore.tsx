import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { type Candidate, ExploreCard } from "../components/ExploreCard"
import { Avatar, PageTitle } from "../components/TattooUI"
import {
	useAllLikes,
	useArtist,
	useArtists,
	useLikes,
	useSend,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	type Artist,
	isEstablished,
	loadWishlist,
	type MatchResult,
	matchSpot,
	NO_STUDIO,
	SPOT_OPEN,
	studioTier,
	type Wishlist,
} from "../lib/tattoo"

// TATTOO APP: Explore as in the Sprint 4. One card at a time, sorted by match.
// Four filters on top: everyone, what I'm looking for (edited in the profile),
// who liked me and one city. A mutual like opens the "It's a match!" pop-up.

const DISMISSED_KEY = "tattoo-dismissed"
const FILTER_KEY = "tattoo-explore-filter"

/** Matches at least the city or the dates of one of my trips */
const fitsMyTrips = (m: MatchResult) =>
	(!!m.trip.city && m.cityOk) ||
	(!!m.trip.from && !!m.trip.to && m.dateOverlap > 0)

type FilterMode = "all" | "wish" | "likedMe" | "city"

interface Filter {
	mode: FilterMode
	city?: string
}

const loadFilter = (): Filter => {
	try {
		const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "null") as
			| Filter
			| string
			| null
		if (saved && typeof saved === "object") return saved
	} catch {
		// no storage, or an older "on" / "off" value
	}
	return { mode: "all" }
}

const saveFilter = (f: Filter) => {
	try {
		localStorage.setItem(FILTER_KEY, JSON.stringify(f))
	} catch {
		// no storage
	}
}

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

const FilterButton = ({
	on,
	disabled,
	onClick,
	children,
}: {
	on: boolean
	disabled?: boolean
	onClick: () => void
	children: React.ReactNode
}) => (
	<button
		className={`filter-btn${on ? " on" : ""}`}
		disabled={disabled}
		onClick={onClick}
	>
		{children}
	</button>
)

const Explore = () => {
	const { address } = useWallet()
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const me = useArtist(address)
	const likes = useLikes(address)
	const allAddresses = useMemo(
		() => (artists.data ?? []).map((a) => a.address),
		[artists.data],
	)
	const allLikes = useAllLikes(allAddresses)
	const send = useSend()

	const wish = useMemo(loadWishlist, [])
	const [filter, setFilterState] = useState<Filter>(loadFilter)
	const [cityMenu, setCityMenu] = useState(false)
	const setFilter = (f: Filter) => {
		setFilterState(f)
		saveFilter(f)
		setCityMenu(false)
	}
	const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
	const [justLiked, setJustLiked] = useState<string[]>([])
	const [notice, setNotice] = useState<React.ReactNode>()
	const [matched, setMatched] = useState<Artist>()
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

	// Cities with at least one studio or published home, A to Z
	const cities = useMemo(
		() =>
			[
				...new Set(
					candidates.map((c) => (c.studio?.city ?? c.artist.city).trim()),
				),
			]
				.filter(Boolean)
				.sort((a, b) => a.localeCompare(b)),
		[candidates],
	)
	const likedMe = new Set(
		[...(allLikes.data?.entries() ?? [])]
			.filter(([, l]) => !!address && l.includes(address))
			.map(([a]) => a),
	)

	const liked = new Set([...(likes.data ?? []), ...justLiked])
	const shown = candidates.filter((c) => {
		switch (filter.mode) {
			case "wish":
				return !canFilter || fitsMyTrips(c.match)
			case "likedMe":
				return likedMe.has(c.artist.address)
			case "city":
				return (
					!filter.city ||
					(c.studio?.city ?? c.artist.city).trim() === filter.city
				)
			default:
				return true
		}
	})
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
			setNotice("Tap «Sign in» at the top to save favorites.")
			return
		}
		if (!me.data) {
			setNotice(
				<>
					First <Link to="/perfil">create your profile</Link> to like artists.
				</>,
			)
			return
		}
		const who = current.artist
		setJustLiked((l) => [...l, who.address])
		setNotice(`♥ ${who.name} is in your favorites.`)
		try {
			const { value } = await send((c, from, o) =>
				c.like_artist({ from, to: who.address }, o),
			)
			if (value) {
				setNotice(undefined)
				setMatched(who)
			}
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
				title="Explore"
				subtitle="Artists and their studios, sorted by how well they match what you're looking for."
			/>

			<div className="ts-card explore-filters">
				<div className="filter-grid">
					<FilterButton
						on={filter.mode === "all"}
						onClick={() => setFilter({ mode: "all" })}
					>
						See everyone
					</FilterButton>
					<FilterButton
						on={filter.mode === "wish"}
						onClick={() => setFilter({ mode: "wish" })}
						disabled={!canFilter}
					>
						What I'm looking for
					</FilterButton>
					<FilterButton
						on={filter.mode === "likedMe"}
						onClick={() => setFilter({ mode: "likedMe" })}
					>
						Liked me
					</FilterButton>
					<div className="filter-city">
						<button
							className={`filter-btn${filter.mode === "city" ? " on" : ""}`}
							onClick={() => setCityMenu(!cityMenu)}
							aria-expanded={cityMenu}
						>
							{filter.mode === "city" && filter.city
								? `📍 ${filter.city}`
								: "By city ▾"}
						</button>
						{cityMenu && (
							<div className="filter-menu">
								{cities.length === 0 ? (
									<p className="hint">No cities yet</p>
								) : (
									cities.map((city) => (
										<button
											key={city}
											onClick={() => setFilter({ mode: "city", city })}
										>
											{city}
										</button>
									))
								)}
							</div>
						)}
					</div>
				</div>
				{filter.mode === "wish" && canFilter && (
					<div className="chips" style={{ marginTop: "0.6rem" }}>
						{wish.trips
							.filter((t) => t.city || (t.from && t.to))
							.map((t, i) => (
								<span key={i} className="pill pill-gray">
									📍 {t.city || "Any city"}
									{t.from && t.to
										? ` · ${t.from.slice(5)} → ${t.to.slice(5)}`
										: ""}
								</span>
							))}
						<Link to="/perfil#lo-que-busco" className="hint">
							Edit in my profile
						</Link>
					</div>
				)}
				{!canFilter && (
					<Link
						to="/perfil#lo-que-busco"
						className="hint"
						style={{ display: "block", marginTop: "0.6rem" }}
					>
						Tell us where you want to go, in your profile →
					</Link>
				)}
			</div>

			<div className="legend" style={{ margin: "0 0 1rem" }}>
				<span className="pill pill-lima">STUDIO</span>
				<span className="pill pill-lavender">HOME</span>
				<span className="pill pill-dark">★ Established</span>
				<span className="pill pill-outline">✦ New</span>
			</div>

			{loading && (
				<div className="empty-state">
					Loading artists from the blockchain...
				</div>
			)}
			{error && (
				<div className="alert alert-error">
					We couldn't read the contract: {(error as Error).message}
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
									✕ Discard
								</button>
								<button className="btn-lime" onClick={() => void like()}>
									♥ Like
								</button>
							</div>
							<p className="hint deck-count">
								{shown.length - deck.length + 1} of {shown.length} · swipe the
								card or use the buttons
							</p>
						</>
					) : (
						<div className="ts-card empty-state">
							{candidates.length === 0
								? "No studios published yet."
								: shown.length === 0
									? filter.mode === "likedMe"
										? "Nobody new liked you yet. Keep exploring!"
										: "Nobody matches this filter. Try See everyone."
									: "You've seen every card."}
							{dismissed.length > 0 && (
								<div style={{ marginTop: "0.75rem" }}>
									<button
										className="btn-ghost"
										onClick={() => {
											setDismissed([])
											saveDismissed([])
										}}
									>
										Show the discarded ones again
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

			{matched && me.data && (
				<MatchPopup
					me={me.data}
					them={matched}
					onClose={() => setMatched(undefined)}
				/>
			)}
		</>
	)
}

/** "It's a match!": both liked each other */
const MatchPopup = ({
	me,
	them,
	onClose,
}: {
	me: Artist
	them: Artist
	onClose: () => void
}) => (
	<div className="modal-backdrop" onClick={onClose}>
		<div
			className="modal match-modal"
			role="dialog"
			aria-modal="true"
			aria-labelledby="match-title"
			onClick={(e) => e.stopPropagation()}
		>
			<div className="match-avatars">
				<Avatar artist={me} big />
				<span className="match-heart">♥</span>
				<Avatar artist={them} big />
			</div>
			<h2 id="match-title">It's a match! 🎨</h2>
			<p>{them.name} likes you too. Pick your dates or say hi in the chat.</p>
			<Link to="/swaps" className="btn-lime btn-block">
				📅 Set dates!
			</Link>
			<button className="btn-ghost btn-block" onClick={onClose}>
				Keep exploring
			</button>
		</div>
	</div>
)

export default Explore
