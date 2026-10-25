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
	studio: "Estudio",
	home: "Estudio + hogar",
	homeonly: "Solo hogar",
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
		<article
			className={`ts-card deck-card${dx ? " dragging" : ""}`}
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
					✕ PASO
				</span>
			)}

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
					title={`Hogar de ${a.name}`}
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
						<Link
							to={`/artista/${a.address}`}
							className="host-name"
							style={{ fontSize: "1.35rem" }}
						>
							{a.name}
						</Link>
						<div
							className="meta"
							style={{ color: "var(--lavender-700)", fontWeight: 700 }}
						>
							{c.studio?.city ?? a.city} · {a.instagram}
						</div>
						<div className="chips" style={{ marginTop: "0.3rem" }}>
							<TierBadge artist={a} />
							<RatingLine artist={a} />
						</div>
					</div>
				</div>

				{c.studio && (
					<div className="meta" style={{ marginTop: "0.85rem" }}>
						<b>{c.studio.name}</b> · ⭐ {studioAvg(c.studio)} (
						{c.studio.review_count}{" "}
						{c.studio.review_count === 1 ? "reseña" : "reseñas"})
						<div className="chips" style={{ marginTop: "0.35rem" }}>
							{c.tier && <StudioTierBadge tier={c.tier} />}
							<BasicsBadge spot={c.studio} />
						</div>
					</div>
				)}

				<MatchSummary m={m} />

				<div className="section-label">Fechas disponibles</div>
				{c.spots.length === 0 ? (
					<p className="hint" style={{ margin: 0 }}>
						Todavía no publicó fechas. Dale like y lo sigues desde tus
						favoritos.
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
									: (studios.find((st) => st.id === s.studio_id)?.name ??
										`Hogar de ${a.name}`)
							}
						/>
					))
				)}
			</div>
		</article>
	)
}

/** Why this card matches: city, dates and supplies, Sprint 4 style chips */
const MatchSummary = ({ m }: { m: MatchResult }) => (
	<>
		<div className="chips" style={{ marginTop: "0.85rem" }}>
			{m.trip.city && (
				<span className={`chip ${m.cityOk ? "chip-has" : "chip-missing"}`}>
					📍 {m.cityOk ? m.trip.city : `No es ${m.trip.city}`}
				</span>
			)}
			{m.trip.from && m.trip.to && (
				<span
					className={`chip ${m.dateOverlap > 0 ? "chip-has" : "chip-missing"}`}
				>
					📅{" "}
					{m.dateOverlap >= 1
						? "Cubre tus fechas"
						: m.dateOverlap > 0
							? `Cubre el ${Math.round(m.dateOverlap * 100)}% de tus fechas`
							: "Sin fechas en tu viaje"}
				</span>
			)}
		</div>
		{m.missing.length === 0 ? (
			<div className="chips" style={{ marginTop: "0.6rem" }}>
				<span className="chip chip-has">✓ Tiene todo lo que necesitas</span>
			</div>
		) : (
			<>
				<div className="section-label missing">Falta</div>
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
		? "Entra para reservar"
		: !me
			? "Crea tu perfil para reservar"
			: needsTrust && !isEstablished(me)
				? "El hogar es solo para establecidxs"
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
				{place && <div className="hint">en {place}</div>}
			</span>
			<span
				className={`pill ${spot.kind === "studio" ? "pill-lima" : "pill-lavender"}`}
			>
				{KIND_LABEL[spot.kind] ?? spot.kind}
			</span>
			{hash ? (
				<span className="pill pill-dark">✓ Reservado</span>
			) : (
				<button
					className="btn-lime"
					disabled={busy || !!blocked}
					title={blocked}
					onClick={() => void book()}
				>
					{busy ? "Reservando..." : "Reservar"}
				</button>
			)}
			{blocked && address && <span className="hint">{blocked}</span>}
			<ErrorNotice error={error} />
			{hash && (
				<TxNotice
					hash={hash}
					text="¡Guest activado! Las fechas quedan confirmadas."
				/>
			)}
		</div>
	)
}
