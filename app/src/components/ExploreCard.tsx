import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useSend, useStudios } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { homePhoto, studioPhoto } from "../lib/photos"
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
import {
	Avatar,
	BasicsBadge,
	Cover,
	ErrorNotice,
	MatchRing,
	RatingLine,
	StudioTierBadge,
	TierBadge,
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
}

const SWIPE = 110

const KIND_LABEL: Record<string, string> = {
	studio: "Studio",
	home: "Studio + home",
	homeonly: "Home only",
}

export const ExploreCard = ({
	c,
	me,
	onLike,
	onNope,
}: {
	c: Candidate
	me?: Artist | null
	onLike: () => void
	onNope: () => void
}) => {
	const [dx, setDx] = useState(0)
	const [flipped, setFlipped] = useState(false)
	const [showDates, setShowDates] = useState(false)
	const startX = useRef<number | null>(null)
	const a = c.artist
	const m = c.match
	const studios = useStudios().data ?? []

	const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
		if ((e.target as HTMLElement).closest("button, a, input")) return
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
				{/* Front: minimal, as in the Sprint 4 */}
				<article className="flip-face ts-card" style={{ cursor: "grab" }}>
					{c.studio && (
						<Cover
							kind="studio"
							src={studioPhoto(c.studio.name)}
							title={c.studio.name}
							subtitle={c.studio.city}
						>
							<div className="cover-corner">
								<MatchRing percent={m.percent} />
							</div>
						</Cover>
					)}
					{c.offersHome && (
						<Cover
							kind="home"
							src={homePhoto(a.name)}
							title={`${a.name}'s home`}
							subtitle={a.city}
						>
							{!c.studio && (
								<div className="cover-corner">
									<MatchRing percent={m.percent} />
								</div>
							)}
						</Cover>
					)}

					<div className="ts-card-body">
						<div className="host-row">
							<Avatar artist={a} big />
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="host-name" style={{ fontSize: "1.35rem" }}>
									{a.name}
								</div>
								<div
									className="meta"
									style={{ color: "var(--lavender-700)", fontWeight: 700 }}
								>
									{c.studio?.city ?? a.city}
								</div>
								<div className="chips" style={{ marginTop: "0.3rem" }}>
									<TierBadge artist={a} />
									{m.missing.length === 0 ? (
										<span className="chip chip-full">✓ 100% match</span>
									) : (
										<span className="chip chip-missing">
											{m.missing.length} missing
										</span>
									)}
								</div>
							</div>
						</div>

						<div className="card-actions" style={{ marginTop: "0.85rem" }}>
							<button
								className="icon-btn"
								title="Available dates"
								aria-pressed={showDates}
								onClick={() => setShowDates(!showDates)}
							>
								📅
								{c.spots.length > 0 && (
									<span className="badge">{c.spots.length}</span>
								)}
							</button>
							<button
								className="icon-btn"
								title="More info"
								onClick={() => setFlipped(true)}
							>
								↻
							</button>
							<Link
								to={`/artista/${a.address}`}
								className="icon-btn"
								title="See profile"
							>
								👤
							</Link>
						</div>

						{showDates && (
							<div style={{ marginTop: "0.6rem" }}>
								{c.spots.length === 0 ? (
									<p className="hint" style={{ margin: 0 }}>
										No dates published yet. Like them to follow them from your
										favorites.
									</p>
								) : (
									c.spots.map((s) => (
										<DateRow
											key={s.id}
											spot={s}
											me={me}
											place={
												s.studio_id === c.studio?.id
													? undefined
													: (studios.find((st) => st.id === s.studio_id)
															?.name ?? `${a.name}'s home`)
											}
										/>
									))
								)}
							</div>
						)}
					</div>
				</article>

				{/* Back: the extra info */}
				<article className="flip-face flip-back ts-card">
					<div className="flip-back-head">
						<b>{a.name}</b>
						<button className="btn-ghost" onClick={() => setFlipped(false)}>
							↩ Back
						</button>
					</div>
					<div className="flip-back-body">
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
						<MatchSummary m={m} />
						<Link
							to={`/artista/${a.address}`}
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

/** Why this card matches: city, dates and supplies, Sprint 4 style chips */
const MatchSummary = ({ m }: { m: MatchResult }) => (
	<>
		<div className="chips" style={{ marginTop: "0.85rem" }}>
			{m.trip.city && (
				<span className={`chip ${m.cityOk ? "chip-has" : "chip-missing"}`}>
					📍 {m.cityOk ? m.trip.city : `Not ${m.trip.city}`}
				</span>
			)}
			{m.trip.from && m.trip.to && (
				<span
					className={`chip ${m.dateOverlap > 0 ? "chip-has" : "chip-missing"}`}
				>
					📅{" "}
					{m.dateOverlap >= 1
						? "Covers your dates"
						: m.dateOverlap > 0
							? `Covers ${Math.round(m.dateOverlap * 100)}% of your dates`
							: "No dates in your trip"}
				</span>
			)}
		</div>
		{m.missing.length === 0 ? (
			<div className="chips" style={{ marginTop: "0.6rem" }}>
				<span className="chip chip-full">✓ 100% match on your must-haves</span>
			</div>
		) : (
			<>
				<div className="section-label missing">Missing</div>
				<div className="chips">
					{m.missing.map((id) => (
						<span key={id} className="chip chip-missing">
							{amenityLabel(id)}
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
	</>
)

/** One published date range, claimable right away with book_spot */
const DateRow = ({
	spot,
	me,
	place,
}: {
	spot: Spot
	me?: Artist | null
	/** Shown when the dates are not at the studio on the cover */
	place?: string
}) => {
	const { address } = useWallet()
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const needsTrust = spot.kind !== "studio"
	const blocked = !address
		? "Sign in to book"
		: !me
			? "Create your profile to book"
			: needsTrust && !isEstablished(me)
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
			<span className="date-text">
				{formatRange(spot.start, spot.end)}
				{place && <div className="hint">at {place}</div>}
			</span>
			<span
				className={`pill ${spot.kind === "studio" ? "pill-lima" : "pill-lavender"}`}
			>
				{KIND_LABEL[spot.kind] ?? spot.kind}
			</span>
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
			{hash && (
				<TxNotice
					hash={hash}
					text="Guest spot booked! The dates are confirmed."
				/>
			)}
		</div>
	)
}
