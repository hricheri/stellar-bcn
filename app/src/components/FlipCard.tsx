import { useState } from "react"
import { Link } from "react-router-dom"
import { useSend } from "../hooks/useTattoo"
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
import {
	Avatar,
	BasicsBadge,
	MatchRing,
	RatingLine,
	TierBadge,
} from "./TattooUI"

export interface Connection {
	artist: Artist
	kind: "match" | "liked" | "likedMe"
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
const TheirCalendar = ({ spots, me }: { spots: Spot[]; me?: Artist | null }) => {
	const send = useSend()
	const [msg, setMsg] = useState<string>()
	if (spots.length === 0) {
		return <div className="hint" style={{ padding: "1rem" }}>No publicó fechas todavía.</div>
	}
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
			{spots.map((s) => (
				<div key={s.id} className="cal-row">
					<span className={`cal-dot ${s.status === SPOT_OPEN ? "free" : "busy"}`} />
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
									.then(() => setMsg("¡Fechas propuestas!"))
									.catch((err: Error) => setMsg(err.message))
							}}
						>
							Proponer
						</button>
					)}
				</div>
			))}
			{msg && <div className="hint">{msg}</div>}
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

	return (
		<div className={`flip${flipped ? " flipped" : ""}`}>
			<div className="flip-inner">
				{/* Frente */}
				<div className="flip-face ts-card" onClick={() => open("chat")}>
					<div className={`spot-cover${c.spot?.kind === "home" ? " home" : ""}`}>
						<div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
							{c.kind === "match" && <span className="pill pill-dark">♥ MATCH</span>}
							{c.kind === "likedMe" && <span className="pill pill-lima">♥ TE DIO LIKE</span>}
							{c.unread > 0 && <span className="pill pill-lavender">💬 {c.unread} nuevo{c.unread > 1 ? "s" : ""}</span>}
							{c.spot && <BasicsBadge spot={c.spot} />}
						</div>
						{c.match && <MatchRing percent={c.match.percent} />}
						<div className="spot-city">{a.city}</div>
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
							<button className="btn-ghost" onClick={() => open("chat")}>💬 Chat</button>
							<button className="btn-ghost" onClick={() => open("cal")}>📅 Fechas</button>
							<Link to={`/artista/${a.address}`}>
								<button className="btn-ghost">👤 Perfil</button>
							</Link>
							{c.kind === "likedMe" && onLike && (
								<button className="btn-lime" onClick={onLike}>♥ Devolver like</button>
							)}
						</div>
					</div>
				</div>

				{/* Dorso */}
				<div className="flip-face flip-back ts-card">
					<div className="flip-back-head">
						<button className="btn-ghost" onClick={() => setFlipped(false)}>← {a.name}</button>
						<div className="chips">
							<button className={`chip-toggle${tab === "chat" ? " on" : ""}`} onClick={() => setTab("chat")}>Chat</button>
							<button className={`chip-toggle${tab === "cal" ? " on" : ""}`} onClick={() => setTab("cal")}>Calendario</button>
						</div>
					</div>
					<div className="flip-back-body">
						{flipped && tab === "chat" && <Chat me={me} other={a} canChat={c.canChat} />}
						{flipped && tab === "cal" && <TheirCalendar spots={theirSpots} me={meProfile} />}
					</div>
				</div>
			</div>
		</div>
	)
}
