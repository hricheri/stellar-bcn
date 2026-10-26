import { useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useLike, useLikes } from "../hooks/useLikes"
import { useProfileOf } from "../hooks/useProfiles"
import { useSend } from "../hooks/useTattoo"
import { useTravelDays } from "../hooks/useTrips"
import {
	useVisitRequestActions,
	useVisitRequests,
} from "../hooks/useVisitRequests"
import { type VisitRequest } from "../lib/supabase"
import { formatRange } from "../lib/tattoo"
import { DAY, DayPicker, toRanges, todayUnix } from "./DayPicker"
import { ErrorNotice } from "./TattooUI"

// TATTOO APP: "I want to visit!" on studios with no free dates, and the
// studio's answer: offering dates, which get published like any free days.

const toDate = (unix: number) =>
	new Date(unix * 1000).toISOString().slice(0, 10)
const toUnix = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000

/** The dates of a request, if the guest gave any */
export const requestRange = (r: VisitRequest) =>
	r.start_date && r.end_date
		? formatRange(toUnix(r.start_date), toUnix(r.end_date))
		: undefined

/** Two-tap range on a calendar */
const useRange = () => {
	const [from, setFrom] = useState<number>()
	const [to, setTo] = useState<number>()
	const pick = (day: number) => {
		if (from === undefined || to !== undefined || day < from) {
			setFrom(day)
			setTo(undefined)
		} else setTo(day)
	}
	const dayClass = (d: number) =>
		d === from || d === to
			? "range-end"
			: from !== undefined && to !== undefined && d > from && d < to
				? "in-range"
				: ""
	return { from, to: to ?? from, pick, dayClass }
}

/** Guest side: the button on a card with no dates, and its little form */
export const WantToVisit = ({
	host,
	studioId,
	studioName,
	startOpen,
	onCancel,
}: {
	host: string
	studioId: number
	studioName: string
	/** Show the form right away, without the button */
	startOpen?: boolean
	onCancel?: () => void
}) => {
	const { session } = useAuth()
	const profile = useProfileOf(host)
	const requests = useVisitRequests()
	const { send } = useVisitRequestActions()
	const travel = useTravelDays().days
	const likes = useLikes()
	const like = useLike()
	const [open, setOpen] = useState(!!startOpen)
	const [message, setMessage] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [sent, setSent] = useState(false)

	// My next trip, to suggest it
	const nextTrip = toRanges(travel.filter((d) => d >= todayUnix()))[0]
	const [useTrip, setUseTrip] = useState(true)

	const already = (requests.data ?? []).some(
		(r) =>
			r.studio_id === studioId && r.host === profile?.id && r.status === "open",
	)

	if (!session)
		return (
			<p className="hint">
				<Link to="/entrar">Sign in</Link> to ask {studioName} for a visit.
			</p>
		)
	if (!profile)
		return (
			<p className="hint">
				This artist hasn't joined with an account yet, so they can't get
				requests.
			</p>
		)
	if (sent || already)
		return (
			<div className="alert alert-info">
				✓ Request sent. {studioName} will offer you dates; you'll see them in{" "}
				<Link to="/guest">Guest</Link>.
			</div>
		)
	if (!open)
		return (
			<button className="btn-lavender btn-block" onClick={() => setOpen(true)}>
				✈ I want to visit!
			</button>
		)

	const submit = async () => {
		setBusy(true)
		setError(undefined)
		try {
			await send({
				host: profile.id,
				studio_id: studioId,
				message: message.trim(),
				...(nextTrip && useTrip
					? {
							start_date: toDate(nextTrip.start),
							end_date: toDate(nextTrip.end - (nextTrip.end % DAY)),
						}
					: {}),
			})
			setSent(true)
			// Wanting to visit means you're interested: save them to favorites
			if (!likes.data?.includes(host)) await like(host).catch(() => false)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="visit-form">
			<p className="hint" style={{ marginTop: 0 }}>
				{studioName} hasn't published free dates. Tell them you'd like to come
				and they'll offer you some.
			</p>
			{nextTrip && (
				<label className="check-row" style={{ marginTop: 0 }}>
					<input
						type="checkbox"
						checked={useTrip}
						onChange={(e) => setUseTrip(e.target.checked)}
					/>
					My trip:{" "}
					{formatRange(nextTrip.start, nextTrip.end - (nextTrip.end % DAY))}
				</label>
			)}
			<div className="field">
				<textarea
					aria-label="Message"
					placeholder="Hi! I'd love to do a guest spot at your studio..."
					maxLength={500}
					rows={3}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
				/>
			</div>
			<div className="card-actions">
				<button
					className="btn-ghost"
					onClick={() => (onCancel ? onCancel() : setOpen(false))}
				>
					Cancel
				</button>
				<button
					className="btn-lime"
					style={{ flex: 1 }}
					disabled={busy}
					onClick={() => void submit()}
				>
					{busy ? "Sending..." : "Send request"}
				</button>
			</div>
			<ErrorNotice error={error} />
		</div>
	)
}

/** Studio side: a request I got, answered by offering dates */
export const OfferDates = ({ r }: { r: VisitRequest }) => {
	const send = useSend()
	const { setStatus } = useVisitRequestActions()
	const range = useRange()
	const [open, setOpen] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const wanted = r.start_date ? toUnix(r.start_date) : undefined

	const act = async (fn: () => Promise<unknown>) => {
		setBusy(true)
		setError(undefined)
		try {
			await fn()
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	const offer = () =>
		act(async () => {
			const start = range.from!
			const last = range.to!
			await send((c, host, o) =>
				c.publish_spot(
					{
						host,
						studio_id: r.studio_id,
						include_home: false,
						start: BigInt(start),
						end: BigInt(last > start ? last : start + 1),
					},
					o,
				),
			)
			await setStatus(r.id, "answered")
		})

	if (!open)
		return (
			<div className="card-actions">
				<button className="btn-lime" onClick={() => setOpen(true)}>
					📅 Offer dates
				</button>
				<button
					className="btn-ghost"
					disabled={busy}
					onClick={() => void act(() => setStatus(r.id, "closed"))}
				>
					Decline
				</button>
				<ErrorNotice error={error} />
			</div>
		)

	return (
		<div className="propose">
			<DayPicker
				startMonth={wanted}
				dayClass={range.dayClass}
				onPick={range.pick}
			/>
			<p className="hint" style={{ margin: "0.5rem 0" }}>
				{range.from === undefined
					? "Tap the first free day, then the last one."
					: `Offer ${formatRange(range.from, range.to!)}. They'll be published as free days.`}
			</p>
			<div className="card-actions">
				<button className="btn-ghost" onClick={() => setOpen(false)}>
					Cancel
				</button>
				<button
					className="btn-lime"
					style={{ flex: 1 }}
					disabled={busy || range.from === undefined}
					onClick={() => void offer()}
				>
					{busy ? "Publishing..." : "Offer these dates"}
				</button>
			</div>
			<ErrorNotice error={error} />
		</div>
	)
}
