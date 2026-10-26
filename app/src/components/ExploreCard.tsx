import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useHomeImage, useStudioImage } from "../hooks/useProfiles"
import { useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	amenityLabel,
	type Artist,
	formatRange,
	isEstablished,
	type MatchResult,
	type Spot,
	type Studio,
	type StudioTier,
} from "../lib/tattoo"
import { CardBack } from "./CardBack"
import { ProposeDates } from "./ProposeDates"
import {
	About,
	Avatar,
	CalendarIcon,
	ErrorNotice,
	NameLine,
	Photo,
	TxNotice,
} from "./TattooUI"

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

/** "Sign in to ..." or "Create your profile to ..." */
const Join = ({ what }: { what: string }) => {
	const { ready, session } = useAuth()
	return ready && !session ? (
		<>
			<Link to="/entrar">Sign in</Link> to {what}.
		</>
	) : (
		<>
			<Link to="/perfil">Create your profile</Link> to {what}.
		</>
	)
}

export const ExploreCard = ({
	c,
	me,
	liked,
	canChat,
	onLike,
	onNope,
}: {
	c: Candidate
	me?: Artist | null
	liked: boolean
	/** A match, or I'm established and can write first */
	canChat: boolean
	onLike: () => void
	onNope: () => void
}) => {
	const [dx, setDx] = useState(0)
	const [flipped, setFlipped] = useState(false)
	// Calendar or visit request, shown over the photos so the card keeps its size
	const [panel, setPanel] = useState<"dates">()
	const startX = useRef<number | null>(null)
	const a = c.artist
	const m = c.match
	const city = c.studio?.city ?? c.spots[0]?.city ?? a.city
	const profile = `/artista/${a.address}`
	const studioImage = useStudioImage(c.studio)
	const homeImage = useHomeImage(a)
	const { session, ready } = useAuth()
	const signedIn = !ready || !!session

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
					<div className="card-photos">
						<CardPhoto
							kind={c.studio ? "studio" : "home"}
							src={c.studio ? studioImage : homeImage}
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
							<CardPhoto kind="home" src={homeImage} alt="Home">
								<span className="pill pill-lavender card-tag">+ HOME</span>
							</CardPhoto>
						)}

						{panel && (
							<div className="card-panel">
								<button
									className="btn-ghost card-panel-close"
									aria-label="Close"
									onClick={() => setPanel(undefined)}
								>
									✕
								</button>
								{c.studio ? (
									me ? (
										<ProposeDates
											host={a.address}
											studioId={c.studio.id}
											inline
										/>
									) : (
										<p className="hint">
											<Join what="request dates" />
										</p>
									)
								) : (
									c.spots.map((s) => <DateRow key={s.id} spot={s} me={me} />)
								)}
							</div>
						)}
					</div>

					<div className="ts-card-body">
						<div className="host-row">
							<Link to={profile} aria-label={`${a.name}'s profile`}>
								<Avatar artist={a} big />
							</Link>
							<div style={{ flex: 1, minWidth: 0 }}>
								<NameLine artist={a} to={profile} />
								<About artist={a} studio={c.studio?.name} />
							</div>
							<button
								className={`cal-btn${panel === "dates" ? " on" : ""}`}
								title="Available dates"
								aria-pressed={panel === "dates"}
								onClick={() =>
									setPanel(panel === "dates" ? undefined : "dates")
								}
							>
								<CalendarIcon />
								{c.sharedDays > 0 && (
									<span
										className="badge"
										title="Days matching your availability"
									>
										{c.sharedDays}
									</span>
								)}
							</button>
						</div>

						<div className="chips" style={{ marginTop: "0.75rem" }}>
							<MaterialsLine m={m} />
						</div>
					</div>
				</article>

				{/* Back: the extra info */}
				<CardBack
					artist={a}
					studio={c.studio}
					tier={c.tier}
					spots={c.spots}
					match={m}
					liked={liked}
					signedIn={signedIn}
					offersHome={c.offersHome || !c.studio}
					me={me ? me.address : undefined}
					canChat={canChat}
					onBack={() => setFlipped(false)}
				/>
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
