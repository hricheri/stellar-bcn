import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useStudioImage } from "../hooks/useProfiles"
import { useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { homePhoto } from "../lib/photos"
import {
	amenityLabel,
	type Artist,
	formatRange,
	isEstablished,
	type MatchResult,
	type Spot,
	type Studio,
	studioAvg,
	type StudioTier,
} from "../lib/tattoo"
import { ProposeDates } from "./ProposeDates"
import {
	Avatar,
	BasicsBadge,
	CalendarIcon,
	ErrorNotice,
	Photo,
	RatingLine,
	StudioTierBadge,
	TierBadge,
	TxNotice,
} from "./TattooUI"
import { WantToVisit } from "./VisitRequest"

/** One artist in Explore: their studio, their home if they offer it, and their open dates */
export interface Candidate {
	artist: Artist
	studio?: Studio
	tier?: StudioTier
	spots: Spot[]
	offersHome: boolean
	match: MatchResult
	/** Their free days that fall on my travel days */
	sharedDays: number
}

const SWIPE = 110

/** Full photo, 4:3 like the originals, with the city big on top */
const CardPhoto = ({
	src,
	alt,
	kind,
	children,
}: {
	src: string
	alt: string
	kind: "studio" | "home"
	children?: React.ReactNode
}) => (
	<div className={`card-photo card-photo-${kind}`}>
		<Photo
			key={src}
			src={src}
			alt={alt}
			fallback={
				<div className="cover-fallback">
					<span className="cover-icon" aria-hidden="true">
						{kind === "studio" ? "✒︎" : "⌂"}
					</span>
				</div>
			}
		/>
		{children}
	</div>
)

/** What I need that the studio doesn't have, one "✕ item" each */
export const MaterialsLine = ({ m }: { m: MatchResult }) =>
	m.missing.length === 0 ? (
		<span className="chip chip-full">✓ 100% match</span>
	) : (
		<>
			{m.missing.map((id) => (
				<span key={id} className="chip chip-missing">
					✕ {amenityLabel(id)}
				</span>
			))}
		</>
	)

export const ExploreCard = ({
	c,
	me,
	liked,
	onLike,
	onNope,
}: {
	c: Candidate
	me?: Artist | null
	liked: boolean
	onLike: () => void
	onNope: () => void
}) => {
	const [dx, setDx] = useState(0)
	const [flipped, setFlipped] = useState(false)
	const [showCal, setShowCal] = useState(false)
	const startX = useRef<number | null>(null)
	const a = c.artist
	const m = c.match
	const city = c.studio?.city ?? c.spots[0]?.city ?? a.city
	const profile = `/artista/${a.address}`
	const studioImage = useStudioImage(c.studio)

	const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
		if ((e.target as HTMLElement).closest("button, a, input, select")) return
		startX.current = e.clientX
		e.currentTarget.setPointerCapture(e.pointerId)
	}
	const onPointerMove = (e: React.PointerEvent) => {
		if (startX.current !== null) setDx(e.clientX - startX.current)
	}
	const onPointerUp = () => {
		if (startX.current === null) return
		startX.current = null
		if (dx > SWIPE) onLike()
		else if (dx < -SWIPE) onNope()
		setDx(0)
	}

	return (
		<div
			className={`flip deck-card${flipped ? " flipped" : ""}${dx ? " dragging" : ""}`}
			style={{
				position: "relative",
				transform: `translateX(${dx}px) rotate(${dx / 22}deg)`,
			}}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerUp}
		>
			{dx > 30 && (
				<span className="deck-stamp like" style={{ opacity: dx / SWIPE }}>
					♥ LIKE
				</span>
			)}
			{dx < -30 && (
				<span className="deck-stamp nope" style={{ opacity: -dx / SWIPE }}>
					✕ NOPE
				</span>
			)}

			<div className="flip-inner">
				{/* Front: city, photos, who, what's missing and the calendar */}
				<article className="flip-face ts-card explore-card">
					<CardPhoto
						kind={c.studio ? "studio" : "home"}
						src={c.studio ? studioImage : homePhoto(a.name)}
						alt={c.studio?.name ?? `${a.name}'s home`}
					>
						<span className="card-city">{city}</span>
						<button
							className="card-flip"
							aria-label="More info"
							onClick={() => setFlipped(true)}
						>
							→
						</button>
					</CardPhoto>
					{c.offersHome && c.studio && (
						<CardPhoto kind="home" src={homePhoto(a.name)} alt="Home">
							<span className="pill pill-lavender card-tag">+ HOME</span>
						</CardPhoto>
					)}

					<div className="ts-card-body">
						<div className="host-row">
							<Link to={profile} aria-label={`${a.name}'s profile`}>
								<Avatar artist={a} big />
							</Link>
							<div style={{ flex: 1, minWidth: 0 }}>
								<Link to={profile} className="host-name card-name">
									{a.name}
								</Link>
								<div className="meta">
									{c.studio?.name ?? "Home only"} · <TierBadge artist={a} />
								</div>
							</div>
							<button
								className={`cal-btn${showCal ? " on" : ""}`}
								title="Available dates"
								aria-pressed={showCal}
								onClick={() => setShowCal(!showCal)}
							>
								<CalendarIcon />
								{c.spots.length > 0 && (
									<span className="badge">{c.spots.length}</span>
								)}
							</button>
						</div>

						<div className="chips" style={{ marginTop: "0.75rem" }}>
							<MaterialsLine m={m} />
							{c.sharedDays > 0 && (
								<span className="chip chip-trip">
									✈ {c.sharedDays} {c.sharedDays === 1 ? "day" : "days"} on your
									trip
								</span>
							)}
						</div>

						{c.spots.length === 0 && !showCal && (
							<div style={{ marginTop: "0.85rem" }}>
								{c.studio && me ? (
									<WantToVisit
										host={a.address}
										studioId={c.studio.id}
										studioName={c.studio.name}
									/>
								) : (
									<p className="hint" style={{ margin: 0 }}>
										No free dates published yet.
										{c.studio && (
											<>
												{" "}
												<Link to="/perfil">Create your profile</Link> to ask for
												a visit.
											</>
										)}
									</p>
								)}
							</div>
						)}

						{showCal && (
							<div style={{ marginTop: "0.85rem" }}>
								{c.studio ? (
									me ? (
										<ProposeDates
											host={a.address}
											studioId={c.studio.id}
											inline
										/>
									) : (
										<p className="hint">
											<Link to="/perfil">Create your profile</Link> to request
											dates.
										</p>
									)
								) : (
									c.spots.map((s) => <DateRow key={s.id} spot={s} me={me} />)
								)}
							</div>
						)}
					</div>
				</article>

				{/* Back: the extra info */}
				<article className="flip-face flip-back ts-card">
					<div className="flip-back-head">
						<button className="btn-ghost" onClick={() => setFlipped(false)}>
							← Back
						</button>
						{liked && <span className="pill pill-dark">♥ In favorites</span>}
					</div>
					<div className="flip-back-body">
						<Link to={profile} className="host-name">
							{a.name}
						</Link>
						<div className="meta">
							{a.instagram} · <RatingLine artist={a} />
						</div>
						{c.studio && (
							<div className="meta" style={{ marginTop: "0.6rem" }}>
								<b>{c.studio.name}</b> · ⭐ {studioAvg(c.studio)} (
								{c.studio.review_count}{" "}
								{c.studio.review_count === 1 ? "review" : "reviews"}) ·{" "}
								{c.studio.members.length}{" "}
								{c.studio.members.length === 1 ? "artist" : "artists"}
								<div className="chips" style={{ marginTop: "0.35rem" }}>
									{c.tier && <StudioTierBadge tier={c.tier} />}
									<BasicsBadge spot={c.studio} />
								</div>
							</div>
						)}
						{c.spots.length > 0 && (
							<>
								<div className="section-label">Free dates</div>
								<div className="chips">
									{c.spots.map((s) => (
										<span key={s.id} className="chip chip-has">
											{formatRange(s.start, s.end)}
											{s.kind !== "studio" ? " · + home" : ""}
										</span>
									))}
								</div>
							</>
						)}
						{m.extras.length > 0 && (
							<>
								<div className="section-label has">Extras</div>
								<div className="chips">
									{m.extras.map((id) => (
										<span key={id} className="chip chip-has">
											{amenityLabel(id)}
										</span>
									))}
								</div>
							</>
						)}
						<Link
							to={profile}
							className="btn-ghost"
							style={{ marginTop: "auto", alignSelf: "flex-start" }}
						>
							See profile and reviews →
						</Link>
					</div>
				</article>
			</div>
		</div>
	)
}

/** A home-only date range, booked right away (homes have no studio to ask) */
const DateRow = ({ spot, me }: { spot: Spot; me?: Artist | null }) => {
	const { address } = useWallet()
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const blocked = !address
		? "Sign in to book"
		: !me
			? "Create your profile to book"
			: !isEstablished(me)
				? "Homes are only for established artists"
				: undefined

	const book = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const { hash } = await send((cl, guest, o) =>
				cl.book_spot({ guest, spot_id: spot.id }, o),
			)
			setHash(hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="date-row">
			<span className="date-text">{formatRange(spot.start, spot.end)}</span>
			{hash ? (
				<span className="pill pill-dark">✓ Booked</span>
			) : (
				<button
					className="btn-lime"
					disabled={busy || !!blocked}
					title={blocked}
					onClick={() => void book()}
				>
					{busy ? "Booking..." : "Book"}
				</button>
			)}
			{blocked && address && <span className="hint">{blocked}</span>}
			<ErrorNotice error={error} />
			{hash && <TxNotice hash={hash} text="Booked! The dates are confirmed." />}
		</div>
	)
}
