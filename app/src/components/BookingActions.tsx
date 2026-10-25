import { useState } from "react"
import { useSend, useStudios } from "../hooks/useTattoo"
import {
	ACTION_LABELS,
	BK_PENDING,
	type Artist,
	type Booking,
	formatDate,
	GUEST_TAGS,
	HOST_TAGS,
	isStudioArtist,
	pendingActions,
	promoDeadline,
	TAG_LABELS,
} from "../lib/tattoo"
import { StarPicker } from "./StarPicker"
import { ErrorNotice, TxNotice } from "./TattooUI"

/** Buttons for whatever `me` has to do next in a booking */
export const BookingActions = ({
	booking,
	me,
	other,
}: {
	booking: Booking
	me: string
	other?: Artist
}) => {
	const send = useSend()
	const studios = useStudios()
	const studioArtist = isStudioArtist(studios.data, booking.studio_id, me)
	const amHost =
		booking.host === me || (studioArtist && booking.status === BK_PENDING)
	const actions = pendingActions(booking, me, studioArtist)

	const [reviewing, setReviewing] = useState(false)
	const [score, setScore] = useState(5)
	const [tags, setTags] = useState<string[]>([])
	const [comment, setComment] = useState("")
	const [busy, setBusy] = useState<string>()
	const [error, setError] = useState<string>()
	const [done, setDone] = useState<{ text: string; hash?: string }>()

	const run = async (
		key: string,
		fn: () => Promise<{ hash?: string }>,
		text: string,
	) => {
		setBusy(key)
		setError(undefined)
		try {
			const { hash } = await fn()
			setDone({ text, hash })
			setReviewing(false)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(undefined)
		}
	}

	const id = { booking_id: booking.id }
	const tagOptions = amHost ? GUEST_TAGS : HOST_TAGS

	return (
		<div>
			<div className="chips" style={{ alignItems: "center" }}>
				{actions.includes("confirmar_fechas") && (
					<>
						<button
							className="btn-lime"
							disabled={!!busy}
							onClick={() =>
								void run(
									"confirm",
									() =>
										send((c, host, o) => c.confirm_booking({ host, ...id }, o)),
									"Fechas confirmadas.",
								)
							}
						>
							{busy === "confirm" ? "..." : "✓ Confirmar fechas"}
						</button>
						<button
							className="btn-ghost"
							disabled={!!busy}
							onClick={() =>
								void run(
									"decline",
									() =>
										send((c, host, o) => c.decline_booking({ host, ...id }, o)),
									"Propuesta rechazada.",
								)
							}
						>
							Rechazar
						</button>
					</>
				)}
				{actions.includes("esperando_host") && (
					<span className="pill pill-gray">
						⏳ {ACTION_LABELS.esperando_host}
					</span>
				)}
				{actions.includes("enviar_grafica") && (
					<button
						className="btn-lavender"
						disabled={!!busy}
						title={`Antes del ${formatDate(promoDeadline(booking.start))}`}
						onClick={() =>
							void run(
								"promo",
								() =>
									send((c, artist, o) =>
										c.mark_promo_sent({ artist, ...id }, o),
									),
								"¡Gráfica marcada como enviada!",
							)
						}
					>
						{busy === "promo" ? "..." : "📣 Ya publiqué la gráfica"}
					</button>
				)}
				{actions.includes("confirmar_estancia") && (
					<button
						className="btn-lime"
						disabled={!!busy}
						onClick={() =>
							void run(
								"complete",
								() => send((c, host, o) => c.complete_stay({ host, ...id }, o)),
								"Estancia completada. Ya pueden reseñarse.",
							)
						}
					>
						{busy === "complete" ? "..." : "🏁 Confirmar que terminó"}
					</button>
				)}
				{actions.includes("resenar") && !reviewing && (
					<button className="btn-lavender" onClick={() => setReviewing(true)}>
						★ Dejar reseña
					</button>
				)}
			</div>

			{reviewing && (
				<div style={{ marginTop: "0.75rem" }}>
					<div className="section-label">
						Reseña a {other?.name ?? (amHost ? "tu guest" : "tu host")}
					</div>
					<StarPicker value={score} onChange={setScore} />
					<div className="chips" style={{ margin: "0.5rem 0" }}>
						{tagOptions.map((t) => (
							<button
								type="button"
								key={t}
								className={`chip-toggle${tags.includes(t) ? " on" : ""}`}
								onClick={() =>
									setTags(
										tags.includes(t)
											? tags.filter((x) => x !== t)
											: [...tags, t],
									)
								}
							>
								{TAG_LABELS[t]}
							</button>
						))}
					</div>
					<div className="field">
						<textarea
							rows={2}
							maxLength={200}
							placeholder="¿Cómo fue la experiencia?"
							value={comment}
							onChange={(e) => setComment(e.target.value)}
						/>
					</div>
					<button
						className="btn-lavender"
						disabled={!!busy}
						onClick={() =>
							void run(
								"review",
								() =>
									send((c, reviewer, o) =>
										c.review_artist(
											{ reviewer, ...id, score, tags, comment },
											o,
										),
									),
								"Reseña guardada on-chain. Ya no se puede borrar ni editar.",
							)
						}
					>
						{busy === "review" ? "Guardando..." : "Publicar reseña"}
					</button>
				</div>
			)}

			<ErrorNotice error={error} />
			{done && <TxNotice hash={done.hash} text={done.text} />}
		</div>
	)
}
