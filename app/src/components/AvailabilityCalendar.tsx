import { useState } from "react"
import { useBookings, useSend, useSpots } from "../hooks/useTattoo"
import {
	type Artist,
	BK_CONFIRMED,
	reputationOf,
	SPOT_OPEN,
	type Studio,
} from "../lib/tattoo"
import { daysBetween, DayPicker, toRanges } from "./DayPicker"
import { ErrorNotice, TxNotice } from "./TattooUI"

/**
 * "Availability" from the Sprint 4: tap days to mark them free (lime) and
 * publish them in one go. Confirmed swaps show in lavender and are locked.
 * Each run of consecutive days becomes one published date range on Stellar.
 */
export const AvailabilityCalendar = ({
	me,
	studios,
}: {
	me: Artist
	studios: Studio[]
}) => {
	const send = useSend()
	const spots = useSpots()
	const bookings = useBookings(me.address)
	const [studioId, setStudioId] = useState<number>()
	const [includeHome, setIncludeHome] = useState(false)
	const [homeCity, setHomeCity] = useState(me.city)
	const [picked, setPicked] = useState<number[]>([])
	const [busy, setBusy] = useState("")
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const unlocked = reputationOf(me).home_swap_unlocked
	// 0 = only my home
	const selected = studioId ?? studios[0]?.id ?? 0
	const homeOnly = selected === 0

	if (studios.length === 0 && !unlocked) return null

	// Dates already on Stellar for this studio (or for my home)
	const mine = (spots.data ?? []).filter((s) =>
		homeOnly
			? s.kind === "homeonly" && s.host === me.address
			: s.studio_id === selected,
	)
	const free = new Set(
		mine
			.filter((s) => s.status === SPOT_OPEN)
			.flatMap((s) => daysBetween(Number(s.start), Number(s.end))),
	)
	const swaps = new Set([
		...mine
			.filter((s) => s.status !== SPOT_OPEN)
			.flatMap((s) => daysBetween(Number(s.start), Number(s.end))),
		...(bookings.data ?? [])
			.filter(
				(b) =>
					b.status === BK_CONFIRMED &&
					b.host === me.address &&
					(homeOnly || b.studio_id === selected),
			)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	])

	const toggle = (day: number) => {
		setHash(undefined)
		setPicked((p) =>
			p.includes(day) ? p.filter((d) => d !== day) : [...p, day],
		)
	}

	const publish = async () => {
		const ranges = toRanges(picked)
		setError(undefined)
		try {
			for (const [n, r] of ranges.entries()) {
				setBusy(
					ranges.length > 1
						? `Publishing ${n + 1} of ${ranges.length}...`
						: "Publishing...",
				)
				const start = BigInt(r.start)
				const end = BigInt(r.end)
				const { hash } = await send((c, host, o) =>
					homeOnly
						? c.publish_home({ host, city: homeCity.trim(), start, end }, o)
						: c.publish_spot(
								{
									host,
									studio_id: selected,
									include_home: includeHome,
									start,
									end,
								},
								o,
							),
				)
				setHash(hash)
				setPicked((p) => p.filter((d) => d < r.start || d > r.end))
			}
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy("")
		}
	}

	return (
		<section className="ts-card" id="availability">
			<div className="ts-card-body">
				<h2 style={{ marginBottom: "0.85rem" }}>Availability</h2>
				<div className="field">
					<label htmlFor="studio">What do you offer?</label>
					<select
						id="studio"
						value={selected}
						onChange={(e) => {
							setStudioId(Number(e.target.value))
							setPicked([])
						}}
					>
						{studios.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({s.city})
							</option>
						))}
						{unlocked && <option value={0}>Only my home (no studio)</option>}
					</select>
				</div>
				{homeOnly && (
					<div className="field">
						<label htmlFor="homecity">City of your home</label>
						<input
							id="homecity"
							value={homeCity}
							onChange={(e) => setHomeCity(e.target.value)}
						/>
					</div>
				)}

				<DayPicker
					dayClass={(d) =>
						swaps.has(d)
							? "swap"
							: free.has(d)
								? "free"
								: picked.includes(d)
									? "new"
									: ""
					}
					isLocked={(d) => swaps.has(d) || free.has(d)}
					onPick={toggle}
				>
					<div className="cal-foot">
						<div>
							<span className="cal-legend">
								<span className="cal-swatch free" /> Available
							</span>
							<span className="cal-legend">
								<span className="cal-swatch new" /> Not published yet
							</span>
							<span className="cal-legend">
								<span className="cal-swatch swap" /> Confirmed swap
							</span>
						</div>
					</div>
				</DayPicker>

				{!homeOnly && (
					<label className="check-row">
						<input
							type="checkbox"
							disabled={!unlocked}
							checked={includeHome}
							onChange={(e) => setIncludeHome(e.target.checked)}
						/>
						🏠 Include my home too
					</label>
				)}
				<p className="hint" style={{ margin: "0.35rem 0 0" }}>
					{unlocked
						? "Only established artists can book your home."
						: "Offering your home unlocks with 3 reviews averaging 4 or more."}
				</p>
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={!!busy || picked.length === 0}
					onClick={() => void publish()}
				>
					{busy ||
						(picked.length === 0
							? "Tap the days you're free"
							: `Publish ${picked.length} ${picked.length === 1 ? "day" : "days"} on Stellar`)}
				</button>
				<ErrorNotice error={error} />
				{hash && picked.length === 0 && (
					<TxNotice hash={hash} text="Published! It's already on Explore." />
				)}
			</div>
		</section>
	)
}
