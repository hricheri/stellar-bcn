import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { type Candidate, ExploreCard } from "../components/ExploreCard"
import { Avatar, PageTitle } from "../components/TattooUI"
import { useLike, useLikedMe, useLikes } from "../hooks/useLikes"
import { useArtist, useArtists, useSpots, useStudios } from "../hooks/useTattoo"
import { useTravelDays } from "../hooks/useTrips"
import { useWallet } from "../hooks/useWallet"
import {
	type Artist,
	isEstablished,
	loadWishlist,
	matchSpot,
	NO_STUDIO,
	type Spot,
	SPOT_OPEN,
	type Studio,
	studioTier,
} from "../lib/tattoo"
import { freeDays, sharedDays } from "../lib/travel"

// TATTOO APP: Explore as in the Sprint 4. One card per studio (or home), and
// you can go back and forth. Studios with free dates come first. Filters on
// top: everyone, matching dates (with my travel days from the Calendar), who
// liked me and one city. A mutual like opens the "It's a match!" pop-up.

const DISMISSED_KEY = "tattoo-dismissed"
const FILTER_KEY = "tattoo-explore-filter"

type FilterMode = "all" | "dates" | "likedMe" | "city"

interface Filter {
	mode: FilterMode
	city?: string
}

const loadFilter = (): Filter => {
	try {
		// Only for this visit: a new visit starts with everyone
		const saved = JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? "null") as
			| Filter
			| string
			| null
		if (saved && typeof saved === "object" && saved.mode !== ("wish" as string))
			return saved
	} catch {
		// no storage, or an older value
	}
	return { mode: "all" }
}

const saveFilter = (f: Filter) => {
	try {
		sessionStorage.setItem(FILTER_KEY, JSON.stringify(f))
	} catch {
		// no storage
	}
}

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
	onClick,
	children,
}: {
	on: boolean
	onClick: () => void
	children: React.ReactNode
}) => (
	<button className={`filter-btn${on ? " on" : ""}`} onClick={onClick}>
		{children}
	</button>
)

/** A card's id: its studio, or the artist for a home-only listing */
const cardId = (c: Candidate) =>
	c.studio ? `studio-${c.studio.id}` : `home-${c.artist.address}`

const Explore = () => {
	const { address } = useWallet()
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const me = useArtist(address)
	const likes = useLikes()
	const allAddresses = useMemo(
		() => (artists.data ?? []).map((a) => a.address),
		[artists.data],
	)
	const likedMe = useLikedMe(allAddresses).data ?? new Set<string>()
	const likeArtist = useLike()

	const wish = useMemo(loadWishlist, [])
	const travel = useTravelDays().days
	const [filter, setFilterState] = useState<Filter>(loadFilter)
	const [cityMenu, setCityMenu] = useState(false)
	const [index, setIndex] = useState(0)
	const [dismissed, setDismissed] = useState<string[]>(loadDismissed)
	const [justLiked, setJustLiked] = useState<string[]>([])
	const [notice, setNotice] = useState<React.ReactNode>()
	const [matched, setMatched] = useState<Artist>()
	const hasProfile = !!me.data

	const setFilter = (f: Filter) => {
		setCityMenu(false)
		if ((f.mode === "dates" || f.mode === "likedMe") && !hasProfile) {
			setNotice(
				<>
					To use this filter, first{" "}
					<Link to="/perfil">create your profile</Link>.
				</>,
			)
			return
		}
		if (f.mode === "dates" && travel.length === 0) {
			setNotice(
				<>
					Mark the days you'd like to travel in your{" "}
					<Link to="/calendario">Calendar</Link> first.
				</>,
			)
			return
		}
		setNotice(undefined)
		setFilterState(f)
		saveFilter(f)
		setIndex(0)
	}

	const candidates = useMemo<Candidate[]>(() => {
		const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
		const open = (spots.data ?? []).filter((s) => s.status === SPOT_OPEN)
		const byStart = (x: Spot, y: Spot) => Number(x.start) - Number(y.start)
		const build = (
			artist: Artist,
			studio: Studio | undefined,
			theirSpots: Spot[],
		): Candidate => ({
			artist,
			studio,
			tier: studio ? studioTier(studio, byAddress) : undefined,
			spots: theirSpots.sort(byStart),
			offersHome: theirSpots.some((s) => s.kind !== "studio"),
			match: matchSpot(
				studio
					? {
							city: studio.city,
							amenities: studio.amenities,
							start: 0n,
							end: 0n,
						}
					: theirSpots[0]!,
				wish,
			),
			sharedDays: sharedDays(travel, freeDays(theirSpots)),
		})

		const out: Candidate[] = []
		for (const studio of studios.data ?? []) {
			if (address && studio.members.includes(address)) continue
			const theirSpots = open.filter((s) => s.studio_id === studio.id)
			// Show the artist who published its latest dates, or its first artist
			const host =
				byAddress.get(theirSpots[theirSpots.length - 1]?.host ?? "") ??
				byAddress.get(studio.members[0] ?? "")
			if (host) out.push(build(host, studio, theirSpots))
		}
		// Homes offered without a studio
		for (const artist of artists.data ?? []) {
			if (artist.address === address) continue
			const homes = open.filter(
				(s) => s.studio_id === NO_STUDIO && s.host === artist.address,
			)
			if (homes.length) out.push(build(artist, undefined, homes))
		}
		return out.sort(
			(x, y) =>
				Number(y.spots.length > 0) - Number(x.spots.length > 0) ||
				y.sharedDays - x.sharedDays ||
				x.match.missing.length - y.match.missing.length ||
				Number(isEstablished(y.artist)) - Number(isEstablished(x.artist)),
		)
	}, [artists.data, studios.data, spots.data, address, wish, travel])

	// Cities with at least one studio or published home, A to Z
	const cities = useMemo(
		() =>
			[
				...new Set(
					candidates.map((c) =>
						(c.studio?.city ?? c.spots[0]?.city ?? "").trim(),
					),
				),
			]
				.filter(Boolean)
				.sort((a, b) => a.localeCompare(b)),
		[candidates],
	)

	const liked = new Set([...(likes.data ?? []), ...justLiked])
	const shown = candidates.filter((c) => {
		if (dismissed.includes(cardId(c))) return false
		switch (filter.mode) {
			case "dates":
				return !hasProfile || c.sharedDays > 0
			case "likedMe":
				return !hasProfile || likedMe.has(c.artist.address)
			case "city":
				return (
					!filter.city ||
					(c.studio?.city ?? c.spots[0]?.city ?? "").trim() === filter.city
				)
			default:
				return true
		}
	})
	const at = shown.length ? Math.min(index, shown.length - 1) : 0
	const current = shown[at]
	const go = (step: number) => {
		if (shown.length < 2) return
		setIndex((at + step + shown.length) % shown.length)
	}

	// ← and → on the keyboard move between cards
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).closest("input, textarea, select")) return
			if (e.key === "ArrowLeft") go(-1)
			if (e.key === "ArrowRight") go(1)
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})

	const nope = () => {
		if (!current) return
		const next = [...dismissed, cardId(current)]
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
					First <Link to="/perfil">create your profile</Link> to save favorites.
				</>,
			)
			return
		}
		const who = current.artist
		go(1)
		if (liked.has(who.address)) return
		setJustLiked((l) => [...l, who.address])
		setNotice(`♥ ${who.name} is in your favorites.`)
		try {
			if (await likeArtist(who.address)) {
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
				subtitle="Studios with free dates come first. Tap the calendar to ask for yours."
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
						on={filter.mode === "dates"}
						onClick={() => setFilter({ mode: "dates" })}
					>
						Matching dates
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
								: "Filter by city ▾"}
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
				{notice && (
					<div className="alert alert-info" style={{ margin: "0.75rem 0 0" }}>
						{notice}
					</div>
				)}
			</div>

			{loading && (
				<div className="empty-state">
					Loading studios from the blockchain...
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
							<div className="deck-stage">
								<button
									className="deck-nav prev"
									aria-label="Previous card"
									disabled={shown.length < 2}
									onClick={() => go(-1)}
								>
									‹
								</button>
								<ExploreCard
									key={cardId(current)}
									c={current}
									me={me.data}
									liked={liked.has(current.artist.address)}
									canChat={
										(liked.has(current.artist.address) &&
											likedMe.has(current.artist.address)) ||
										(!!me.data && isEstablished(me.data))
									}
									onLike={() => void like()}
									onNope={nope}
								/>
								<button
									className="deck-nav next"
									aria-label="Next card"
									disabled={shown.length < 2}
									onClick={() => go(1)}
								>
									›
								</button>
							</div>
							<div className="deck-actions">
								<button className="btn-ghost" onClick={nope}>
									✕ Discard
								</button>
								<button
									className="btn-lime"
									disabled={liked.has(current.artist.address)}
									onClick={() => void like()}
								>
									{liked.has(current.artist.address) ? "♥ Saved" : "♥ Like"}
								</button>
							</div>
							<p className="hint deck-count">
								{at + 1} of {shown.length}
							</p>
						</>
					) : (
						<div className="ts-card empty-state">
							{candidates.length === 0
								? "No studios published yet."
								: filter.mode === "likedMe"
									? "Nobody new liked you yet. Keep exploring!"
									: filter.mode === "dates"
										? "No studio is free on your travel days yet."
										: "Nothing here. Try See everyone."}
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
			<Link to="/favoritos" className="btn-lime btn-block">
				📅 Request dates
			</Link>
			<button className="btn-ghost btn-block" onClick={onClose}>
				Keep exploring
			</button>
		</div>
	</div>
)

export default Explore
