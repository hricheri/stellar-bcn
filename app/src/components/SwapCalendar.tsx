import { useMemo, useState } from "react"

export type CalendarKind = "available" | "confirmed" | "proposed" | "deadline"

export interface CalendarEvent {
	kind: CalendarKind
	/** Unix seconds, inclusive */
	start: number
	end: number
	label: string
}

const KIND_LABELS: Record<CalendarKind, string> = {
	available: "My studio is free",
	confirmed: "Confirmed swap",
	proposed: "Proposed dates",
	deadline: "Deadline",
}

const DAY = 86_400
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

const utcDay = (y: number, m: number, d: number) => Date.UTC(y, m, d) / 1000

/** Month grid with my availability, swaps, proposals of my matches and deadlines */
export const SwapCalendar = ({ events }: { events: CalendarEvent[] }) => {
	// Start at the month of the next upcoming event (or today)
	const first = useMemo(() => {
		const now = Date.now() / 1000
		const next = events
			.filter((e) => e.end >= now)
			.sort((a, b) => a.start - b.start)[0]
		const d = new Date((next ? Math.max(next.start, now) : now) * 1000)
		return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
	}, [events])
	const [offset, setOffset] = useState(0)
	const [selected, setSelected] = useState<number>()

	const y = first.y + Math.floor((first.m + offset) / 12)
	const m = (((first.m + offset) % 12) + 12) % 12
	const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
	const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7
	const title = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-GB", {
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	})

	const on = (day: number) =>
		events.filter((e) => e.start <= day && day <= e.end + DAY - 1)

	const today = Math.floor(Date.now() / 1000 / DAY) * DAY
	const selectedEvents = selected !== undefined ? on(selected) : []

	return (
		<div>
			<div className="cal-head">
				<button
					className="btn-ghost"
					onClick={() => setOffset(offset - 1)}
					aria-label="Previous month"
				>
					←
				</button>
				<h3 style={{ textTransform: "capitalize" }}>{title}</h3>
				<button
					className="btn-ghost"
					onClick={() => setOffset(offset + 1)}
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
					const evs = on(day)
					const kinds = new Set(evs.map((e) => e.kind))
					const fill = kinds.has("confirmed")
						? "confirmed"
						: kinds.has("proposed")
							? "proposed"
							: kinds.has("available")
								? "available"
								: ""
					return (
						<button
							key={i}
							className={`cal-day ${fill}${day === today ? " today" : ""}${selected === day ? " selected" : ""}`}
							onClick={() => setSelected(day)}
						>
							{i + 1}
							{kinds.has("deadline") && <span className="cal-deadline" />}
						</button>
					)
				})}
			</div>
			<div className="chips" style={{ marginTop: "0.75rem" }}>
				{(Object.keys(KIND_LABELS) as CalendarKind[]).map((k) => (
					<span key={k} className="cal-legend">
						<span className={`cal-swatch ${k}`} /> {KIND_LABELS[k]}
					</span>
				))}
			</div>
			{selectedEvents.length > 0 && (
				<div style={{ marginTop: "0.75rem" }}>
					{selectedEvents.map((e, i) => (
						<div key={i} className="cal-row">
							<span className={`cal-swatch ${e.kind}`} />
							<span>{e.label}</span>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
