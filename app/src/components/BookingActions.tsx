import { useState } from "react"
import { useSend, useStudios } from "../hooks/useTattoo"
import {
	ACTION_LABELS,
	BK_PENDING,
	type Artist,
	type Booking,
	GUEST_TAGS,
	HOST_TAGS,
	NO_STUDIO,
	STUDIO_TAGS,
	isStudioArtist,
	pendingActions,
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

	const [reviewing, setReviewing] = useState<false | "artist" | "studio">(false)
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
	const tagOptions =
		reviewing === "studio" ? STUDIO_TAGS : amHost ? GUEST_TAGS : HOST_TAGS
	const studio = (studios.data ?? []).find((s) => s.id === booking.studio_id)
	const artistReviewPending = !(amHost
		? booking.host_reviewed
		: booking.guest_reviewed)
	const studioReviewPending =
		!amHost && booking.studio_id !== NO_STUDIO && !booking.studio_reviewed

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
									"Dates confirmed.",
								)
							}
						>
							{busy === "confirm" ? "..." : "✓ Accept"}
						</button>
						<button
							className="btn-ghost"
							disabled={!!busy}
							onClick={() =>
								void run(
									"decline",
									() =>
										send((c, host, o) => c.decline_booking({ host, ...id }, o)),
									"Proposal declined.",
								)
							}
						>
							Decline
						</button>
					</>
				)}
				{actions.includes("esperando_host") && (
					<span className="pill pill-gray">
						⏳ {ACTION_LABELS.esperando_host}
					</span>
				)}
				{actions.includes("confirmar_estancia") && (
					<button
						className="btn-lime"
						disabled={!!busy}
						onClick={() =>
							void run(
								"complete",
								() => send((c, host, o) => c.complete_stay({ host, ...id }, o)),
								"Stay completed. You can now review each other.",
							)
						}
					>
						{busy === "complete" ? "..." : "🏁 Confirm it ended"}
					</button>
				)}
				{actions.includes("resenar") && !reviewing && artistReviewPending && (
					<button
						className="btn-lavender"
						onClick={() => setReviewing("artist")}
					>
						★ Review {other?.name ?? (amHost ? "your guest" : "your host")}
					</button>
				)}
				{actions.includes("resenar") && !reviewing && studioReviewPending && (
					<button
						className="btn-lavender"
						onClick={() => setReviewing("studio")}
					>
						🏠 Review the studio
					</button>
				)}
			</div>

			{reviewing && (
				<div style={{ marginTop: "0.75rem" }}>
					<div className="section-label">
						{reviewing === "studio"
							? `Review of the studio ${studio?.name ?? ""}`
							: `Review of ${other?.name ?? (amHost ? "your guest" : "your host")}`}
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
							placeholder="How was it?"
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
										reviewing === "studio"
											? c.review_studio(
													{ guest: reviewer, ...id, score, tags, comment },
													o,
												)
											: c.review_artist(
													{ reviewer, ...id, score, tags, comment },
													o,
												),
									),
								"Review saved on-chain. It can't be deleted or edited.",
							)
						}
					>
						{busy === "review" ? "Saving..." : "Post review"}
					</button>
				</div>
			)}

			<ErrorNotice error={error} />
			{done && <TxNotice hash={done.hash} text={done.text} />}
		</div>
	)
}
