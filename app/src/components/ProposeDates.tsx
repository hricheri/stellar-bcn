import { useState } from "react"
import { useSend, useSpots, useStudios } from "../hooks/useTattoo"
import { formatRange, SPOT_OPEN } from "../lib/tattoo"
import { daysBetween, DayPicker } from "./DayPicker"
import { ErrorNotice, TxNotice } from "./TattooUI"

/**
 * "Set dates" from the Sprint 4: their free days have a lime ring, and you pick
 * your range with two taps (first and last day). Any artist of the studio
 * reviews the proposal and accepts or declines it.
 */
export const ProposeDates = ({
	host,
	label = "📅 Set dates!",
}: {
	host: string
	label?: string
}) => {
	const send = useSend()
	const studios = useStudios()
	const spots = useSpots()
	const theirStudios = (studios.data ?? []).filter((s) =>
		s.members.includes(host),
	)
	const [open, setOpen] = useState(false)
	const [studioId, setStudioId] = useState<number>()
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

	const theirFree = new Set(
		(spots.data ?? [])
			.filter((s) => s.studio_id === selected && s.status === SPOT_OPEN)
			.flatMap((s) => daysBetween(Number(s.start), Number(s.end))),
	)
	const firstFree = [...theirFree].sort((a, b) => a - b)[0]

	const pick = (day: number) => {
		setHash(undefined)
		if (from === undefined || to !== undefined || day < from) {
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
			setHash(hash)
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
			<div className="split-title" style={{ margin: "0 0 0.5rem" }}>
				<div className="section-label" style={{ margin: 0 }}>
					Set dates
				</div>
				<button className="btn-ghost" onClick={() => setOpen(false)}>
					✕
				</button>
			</div>
			{theirStudios.length > 1 && (
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
						theirFree.has(d) ? "theirs" : "",
						ends ? "range-end" : inside ? "in-range" : "",
					].join(" ")
				}}
				onPick={pick}
			>
				<div className="cal-foot">
					<div>
						<span className="cal-legend">
							<span className="cal-swatch theirs" /> They're free
						</span>
						<span className="cal-legend">
							<span className="cal-swatch range-end" /> Your dates
						</span>
					</div>
				</div>
			</DayPicker>
			<p className="hint" style={{ margin: "0.5rem 0" }}>
				{from === undefined
					? "Tap your first day, then your last one."
					: to === undefined
						? "Now tap your last day (or send it as a single day)."
						: formatRange(from, to)}
			</p>
			<button
				className="btn-lime btn-block"
				disabled={busy || from === undefined}
				onClick={() => void propose()}
			>
				{busy ? "Sending..." : "Send proposal"}
			</button>
			<ErrorNotice error={error} />
			{hash && (
				<TxNotice
					hash={hash}
					text="Proposal sent. The studio will accept or decline it."
				/>
			)}
		</div>
	)
}
