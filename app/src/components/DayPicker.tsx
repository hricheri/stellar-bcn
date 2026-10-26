import { useState } from "react"

// TATTOO APP: month grid from the Sprint 4 calendar. Weeks start on Monday,
// you can browse from this month up to 12 months ahead and past days are off.

export const DAY = 86_400
const MAX_MONTHS = 12
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** Midnight UTC of a day, in unix seconds */
export const utcDay = (y: number, m: number, d: number) =>
	Date.UTC(y, m, d) / 1000

export const todayUnix = () => Math.floor(Date.now() / 1000 / DAY) * DAY

/** Every day (midnight UTC) between two unix times, both included */
export const daysBetween = (start: number, end: number) => {
	const out: number[] = []
	for (let d = Math.floor(start / DAY) * DAY; d <= end; d += DAY) out.push(d)
	return out
}

/**
 * Groups days into runs of consecutive days, for the contract's date ranges.
 * A one-day range ends one second later, since the contract wants end > start.
 */
export const toRanges = (days: number[]) => {
	const sorted = [...days].sort((a, b) => a - b)
	const ranges: { start: number; end: number }[] = []
	for (const d of sorted) {
		const last = ranges[ranges.length - 1]
		if (last && d === last.end + DAY) last.end = d
		else ranges.push({ start: d, end: d })
	}
	return ranges.map((r) => ({
		start: r.start,
		end: r.end === r.start ? r.start + 1 : r.end,
	}))
}

/** Range marking: tap the first and last day; tap a marked day to unmark it */
export const useRangeMarking = (
	marked: number[],
	setMarked: (days: number[]) => void,
	locked: (day: number) => boolean,
) => {
	const [anchor, setAnchor] = useState<number>()
	const pick = (day: number) => {
		const has = marked.includes(day)
		if (anchor !== undefined && anchor !== day && !has) {
			const [a, b] = anchor < day ? [anchor, day] : [day, anchor]
			const range = daysBetween(a, b).filter((d) => !locked(d))
			setMarked([...new Set([...marked, ...range])])
			setAnchor(undefined)
		} else if (has) {
			setMarked(marked.filter((d) => d !== day))
			setAnchor(undefined)
		} else {
			setMarked([...marked, day])
			setAnchor(day)
		}
	}
	return { anchor, pick, reset: () => setAnchor(undefined) }
}

export const DayPicker = ({
	dayClass,
	isLocked,
	onPick,
	startMonth,
	children,
}: {
	/** Extra classes for a day, like "available" or "confirmed" */
	dayClass: (day: number) => string
	/** Days that can't be clicked (besides past ones) */
	isLocked?: (day: number) => boolean
	onPick: (day: number) => void
	/** Unix time of a day to open on (defaults to today) */
	startMonth?: number
	/** Legend and buttons under the grid */
	children?: React.ReactNode
}) => {
	const now = new Date()
	const first = { y: now.getUTCFullYear(), m: now.getUTCMonth() }
	const initial = (() => {
		if (!startMonth) return 0
		const d = new Date(startMonth * 1000)
		const diff = (d.getUTCFullYear() - first.y) * 12 + d.getUTCMonth() - first.m
		return Math.max(0, Math.min(MAX_MONTHS, diff))
	})()
	const [offset, setOffset] = useState(initial)

	const y = first.y + Math.floor((first.m + offset) / 12)
	const m = (first.m + offset) % 12
	const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
	const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7
	const title = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})
	const today = todayUnix()

	return (
		<div>
			<div className="cal-head">
				<button
					type="button"
					className="btn-ghost"
					onClick={() => setOffset(offset - 1)}
					disabled={offset <= 0}
					aria-label="Previous month"
				>
					←
				</button>
				<h3>{title}</h3>
				<button
					type="button"
					className="btn-ghost"
					onClick={() => setOffset(offset + 1)}
					disabled={offset >= MAX_MONTHS}
					aria-label="Next month"
				>
					→
				</button>
			</div>
			<div className="cal-grid">
				{WEEKDAYS.map((w) => (
					<div key={w} className="cal-weekday">
						{w}
					</div>
				))}
				{Array.from({ length: lead }, (_, i) => (
					<div key={`l${i}`} />
				))}
				{Array.from({ length: daysInMonth }, (_, i) => {
					const day = utcDay(y, m, i + 1)
					const past = day < today
					return (
						<button
							type="button"
							key={i}
							className={`cal-day ${dayClass(day)}${past ? " past" : ""}${day === today ? " today" : ""}`}
							disabled={past || !!isLocked?.(day)}
							onClick={() => onPick(day)}
						>
							{i + 1}
						</button>
					)
				})}
			</div>
			{children}
		</div>
	)
}
