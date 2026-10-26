import { useState } from "react"
import { useLike, useLikes } from "../hooks/useLikes"
import { useSend, useSpots, useStudios } from "../hooks/useTattoo"
import { useTravelDays } from "../hooks/useTrips"
import { formatRange } from "../lib/tattoo"
import { freeDays } from "../lib/travel"
import { DayPicker } from "./DayPicker"
import { ErrorNotice } from "./TattooUI"

/**
 * Request dates (the Sprint 4 "Set dates"): their free days are lime, my travel days have
 * a lavender ring, and you pick your range with two taps (first and last day).
 * It's a request: any artist of the studio accepts or declines it.
 */
export const ProposeDates = ({
	host,
	studioId: fixedStudio,
	label = "📅 Request dates",
	inline = false,
}: {
	host: string
	/** Studio to ask; otherwise the first one of the host */
	studioId?: number
	label?: string
	/** Show the calendar right away, without its button */
	inline?: boolean
}) => {
	const send = useSend()
	const studios = useStudios()
	const spots = useSpots()
	const travelDays = useTravelDays().days
	const likes = useLikes()
	const like = useLike()
	const theirStudios = (studios.data ?? []).filter((s) =>
		s.members.includes(host),
	)
	const [open, setOpen] = useState(inline)
	const [studioId, setStudioId] = useState<number | undefined>(fixedStudio)
	const [from, setFrom] = useState<number>()
	const [to, setTo] = useState<number>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	if (theirStudios.length === 0) {
		return (
			<div className="hint" onClick={(e) => e.stopPropagation()}>
				They don't have a studio to propose dates to yet.
			</div>
		)
	}
	const selected = studioId ?? theirStudios[0]!.id

	if (!open) {
		return (
			<button
				className="btn-lavender"
				onClick={(e) => {
					e.stopPropagation()
					setOpen(true)
				}}
			>
				{label}
			</button>
		)
	}

	const theirFree = freeDays(
		(spots.data ?? []).filter((s) => s.studio_id === selected),
	)
	const travel = new Set(travelDays)
	const firstFree = [...theirFree].sort((a, b) => a - b)[0]

	const studioName = theirStudios.find((s) => s.id === selected)?.name

	// Only their free days, and a range can't jump over a busy one
	const pick = (day: number) => {
		setHash(undefined)
		const gap =
			from !== undefined &&
			[...Array(Math.max(0, Math.round((day - from) / 86_400)))].some(
				(_, i) => !theirFree.has(from + i * 86_400),
			)
		if (from === undefined || to !== undefined || day < from || gap) {
			setFrom(day)
			setTo(undefined)
		} else setTo(day)
	}

	const propose = async () => {
		if (from === undefined) return
		setBusy(true)
		setError(undefined)
		try {
			const end = to === undefined || to === from ? from + 1 : to
			const { hash } = await send((c, guest, o) =>
				c.propose_dates(
					{
						guest,
						studio_id: selected,
						start: BigInt(from),
						end: BigInt(end),
					},
					o,
				),
			)
			setHash(hash || "sent")
			// Asking for dates means you're interested: save them to favorites
			if (!likes.data?.includes(host)) await like(host).catch(() => false)
			setFrom(undefined)
			setTo(undefined)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="propose" onClick={(e) => e.stopPropagation()}>
			{!inline && (
				<div className="split-title" style={{ margin: "0 0 0.5rem" }}>
					<div className="section-label" style={{ margin: 0 }}>
						Request dates
					</div>
					<button className="btn-ghost" onClick={() => setOpen(false)}>
						✕
					</button>
				</div>
			)}
			{theirStudios.length > 1 && fixedStudio === undefined && (
				<div className="field">
					<select
						aria-label="Studio"
						value={selected}
						onChange={(e) => setStudioId(Number(e.target.value))}
					>
						{theirStudios.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({s.city})
							</option>
						))}
					</select>
				</div>
			)}
			<DayPicker
				key={selected}
				startMonth={firstFree}
				dayClass={(d) => {
					const ends = d === from || d === to
					const inside =
						from !== undefined && to !== undefined && d > from && d < to
					return [
						ends
							? "range-end"
							: inside
								? "in-range"
								: theirFree.has(d)
									? "free"
									: "",
						travel.has(d) ? "trip" : "",
					].join(" ")
				}}
				isLocked={(d) => !theirFree.has(d)}
				onPick={pick}
			>
				<div className="cal-foot">
					<div>
						<span className="cal-legend">
							<span className="cal-swatch free" /> Studio's availability
						</span>
						{travel.size > 0 && (
							<span className="cal-legend">
								<span className="cal-swatch trip" /> Your availability
							</span>
						)}
						<span className="cal-legend">
							<span className="cal-swatch range-end" /> Request guest
						</span>
					</div>
				</div>
			</DayPicker>
			<p className="hint" style={{ margin: "0.5rem 0" }}>
				{theirFree.size === 0
					? "No available dates yet."
					: from === undefined
						? "Tap your first day, then your last one."
						: to === undefined
							? "Now tap your last day (or send it as a single day)."
							: formatRange(from, to)}
			</p>
			<div className="propose-send">
				{hash ? (
					<div className="alert alert-ok">
						✓ Request sent to {studioName}! They'll answer you in Guest spots.
					</div>
				) : (
					<button
						className="btn-lavender btn-block"
						disabled={busy || from === undefined}
						onClick={() => void propose()}
					>
						{busy ? "Sending..." : "✈ I want to visit!"}
					</button>
				)}
				<ErrorNotice error={error} />
			</div>
		</div>
	)
}
