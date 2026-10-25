import { useState } from "react"
import { Link } from "react-router-dom"
import { useSend, useStudios } from "../hooks/useTattoo"
import { homePhoto, studioPhoto } from "../lib/photos"
import {
	ACTION_LABELS,
	type Artist,
	type Booking,
	formatRange,
	type MatchResult,
	type PendingAction,
	type Spot,
	SPOT_OPEN,
} from "../lib/tattoo"
import { Chat } from "./Chat"
import { ProposeDates } from "./ProposeDates"
import {
	Avatar,
	BasicsBadge,
	Cover,
	MatchRing,
	RatingLine,
	TierBadge,
} from "./TattooUI"

export interface Connection {
	artist: Artist
	/** contact: no match, but you have a conversation (an established artist wrote first) */
	kind: "match" | "liked" | "likedMe" | "contact"
	/** Their open spot, if any */
	spot?: Spot
	booking?: Booking
	bookingSpot?: Spot
	match?: MatchResult
	actions: PendingAction[]
	unread: number
	canChat: boolean
}

/** Their spots, as a small availability calendar */
const TheirCalendar = ({
	spots,
	me,
	host,
}: {
	spots: Spot[]
	me?: Artist | null
	host?: string
}) => {
	const send = useSend()
	const [msg, setMsg] = useState<string>()
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
			{spots.length === 0 && (
				<div className="hint">No publicó fechas todavía.</div>
			)}
			{spots.map((s) => (
				<div key={s.id} className="cal-row">
					<span
						className={`cal-dot ${s.status === SPOT_OPEN ? "free" : "busy"}`}
					/>
					<div style={{ flex: 1 }}>
						<b>{formatRange(s.start, s.end)}</b>
						<div className="hint">
							{s.city} · {s.status === SPOT_OPEN ? "Disponible" : "Reservado"}
							{s.kind === "home" ? " · estudio + hogar" : ""}
						</div>
					</div>
					{s.status === SPOT_OPEN && me && (
						<button
							className="btn-lime"
							onClick={(e) => {
								e.stopPropagation()
								send((c, guest, o) => c.book_spot({ guest, spot_id: s.id }, o))
									.then(() =>
										setMsg("¡Reservado! Las fechas quedan confirmadas."),
									)
									.catch((err: Error) => setMsg(err.message))
							}}
						>
							Reservar
						</button>
					)}
				</div>
			))}
			{msg && <div className="hint">{msg}</div>}
			{me && host && <ProposeDates host={host} />}
		</div>
	)
}

export const FlipCard = ({
	c,
	me,
	meProfile,
	theirSpots,
	onLike,
}: {
	c: Connection
	me: string
	meProfile?: Artist | null
	theirSpots: Spot[]
	onLike?: () => void
}) => {
	const [flipped, setFlipped] = useState(false)
	const [tab, setTab] = useState<"chat" | "cal">("chat")
	const open = (t: "chat" | "cal") => {
		setTab(t)
		setFlipped(true)
	}
	const a = c.artist
	const studios = useStudios()
	const studio = (studios.data ?? []).find((s) =>
		c.spot ? s.id === c.spot.studio_id : s.members.includes(a.address),
	)

	return (
		<div className={`flip${flipped ? " flipped" : ""}`}>
			<div className="flip-inner">
				{/* Frente */}
				<div className="flip-face ts-card" onClick={() => open("chat")}>
					<Cover
						kind={c.spot?.kind === "homeonly" ? "home" : "studio"}
						src={
							c.spot?.kind === "homeonly"
								? homePhoto(a.name)
								: studioPhoto(studio?.name ?? "")
						}
						title={
							c.spot?.kind === "homeonly"
								? `Hogar de ${a.name}`
								: (studio?.name ?? a.city)
						}
						subtitle={studio?.city ?? a.city}
					>
						<div className="cover-corner">
							{c.match && <MatchRing percent={c.match.percent} />}
						</div>
					</Cover>
					<div className="chips" style={{ padding: "0.85rem 1.25rem 0" }}>
						{c.kind === "match" && (
							<span className="pill pill-dark">♥ Match</span>
						)}
						{c.kind === "likedMe" && (
							<span className="pill pill-outline-dark">♥ Te dio like</span>
						)}
						{c.kind === "contact" && (
							<span className="pill pill-outline">💬 Conversación</span>
						)}
						{c.unread > 0 && (
							<span className="pill pill-dark">
								💬 {c.unread} nuevo{c.unread > 1 ? "s" : ""}
							</span>
						)}
						{c.spot && <BasicsBadge spot={c.spot} />}
					</div>
					<div className="ts-card-body">
						<div className="host-row">
							<Avatar artist={a} />
							<div>
								<div className="host-name">{a.name}</div>
								<TierBadge artist={a} /> <RatingLine artist={a} />
							</div>
						</div>
						{c.spot && (
							<div className="meta" style={{ marginTop: "0.6rem" }}>
								📅 Libre {formatRange(c.spot.start, c.spot.end)}
							</div>
						)}
						{c.actions.length > 0 && (
							<div className="chips" style={{ marginTop: "0.6rem" }}>
								{c.actions.map((x) => (
									<span key={x} className="chip chip-missing">
										{ACTION_LABELS[x]}
									</span>
								))}
							</div>
						)}
						<div className="card-actions" onClick={(e) => e.stopPropagation()}>
							<button className="btn-ghost" onClick={() => open("chat")}>
								💬 Chat
							</button>
							<button className="btn-ghost" onClick={() => open("cal")}>
								📅 Fechas
							</button>
							<Link to={`/artista/${a.address}`}>
								<button className="btn-ghost">👤 Perfil</button>
							</Link>
							{c.kind === "likedMe" && onLike && (
								<button className="btn-lime" onClick={onLike}>
									♥ Devolver like
								</button>
							)}
						</div>
					</div>
				</div>

				{/* Dorso */}
				<div className="flip-face flip-back ts-card">
					<div className="flip-back-head">
						<button className="btn-ghost" onClick={() => setFlipped(false)}>
							← {a.name}
						</button>
						<div className="chips">
							<button
								className={`chip-toggle${tab === "chat" ? " on" : ""}`}
								onClick={() => setTab("chat")}
							>
								Chat
							</button>
							<button
								className={`chip-toggle${tab === "cal" ? " on" : ""}`}
								onClick={() => setTab("cal")}
							>
								Calendario
							</button>
						</div>
					</div>
					<div className="flip-back-body">
						{flipped && tab === "chat" && (
							<Chat me={me} other={a} canChat={c.canChat} />
						)}
						{flipped && tab === "cal" && (
							<TheirCalendar
								spots={theirSpots}
								me={meProfile}
								host={a.address}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
