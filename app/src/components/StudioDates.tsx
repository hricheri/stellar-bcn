import { useState } from "react"
import { useProfileOf } from "../hooks/useProfiles"
import { useArtist, useBookings, useSend, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	BK_CONFIRMED,
	BK_PENDING,
	reputationOf,
	SPOT_OPEN,
	type Studio,
} from "../lib/tattoo"
import { daysBetween, DayPicker, toRanges, useRangeMarking } from "./DayPicker"
import { ErrorNotice, TxNotice } from "./TattooUI"

// TATTOO APP: in the Studio menu, the days my studio is free. They go to
// Stellar and show up in Explore.

export const StudioDates = ({ studios }: { studios: Studio[] }) => {
	const { address } = useWallet()
	const me = useArtist(address)
	const spots = useSpots()
	const bookings = useBookings(address)
	const send = useSend()
	const [studioId, setStudioId] = useState<number>()
	const [includeHome, setIncludeHome] = useState(false)
	const [pending, setPending] = useState<number[]>([])
	const [busy, setBusy] = useState("")
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	const myProfile = useProfileOf(address)
	// Home dates only once the home is unlocked and filled in on my profile
	const hasHome = !!(
		myProfile?.home_description.trim() || myProfile?.home_photo_path
	)
	const unlocked =
		hasHome && (me.data ? reputationOf(me.data).home_swap_unlocked : false)
	// 0 = only my home
	const selected = studioId ?? studios[0]?.id ?? 0
	const homeOnly = selected === 0

	const mine = (spots.data ?? []).filter((s) =>
		homeOnly
			? s.kind === "homeonly" && s.host === address
			: s.studio_id === selected,
	)
	const free = new Set(
		mine
			.filter((s) => s.status === SPOT_OPEN)
			.flatMap((s) => daysBetween(Number(s.start), Number(s.end))),
	)
	// Guests coming to me
	const hosting = (bookings.data ?? []).filter((b) => b.host === address)
	const confirmed = new Set(
		hosting
			.filter((b) => b.status === BK_CONFIRMED)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)
	const requested = new Set(
		hosting
			.filter((b) => b.status === BK_PENDING)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)
	const marking = useRangeMarking(
		pending,
		setPending,
		(d) => free.has(d) || confirmed.has(d),
	)

	const publish = async () => {
		const ranges = toRanges(pending)
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
						? c.publish_home({ host, city: me.data?.city ?? "", start, end }, o)
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
				setPending((p) => p.filter((d) => d < r.start || d > r.end))
			}
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy("")
		}
	}

	return (
		<section className="ts-card" id="fechas">
			<div className="ts-card-body">
				{(studios.length > 1 || unlocked) && (
					<div className="field">
						<select
							aria-label="Studio"
							value={selected}
							onChange={(e) => {
								setStudioId(Number(e.target.value))
								setPending([])
								marking.reset()
							}}
						>
							{studios.map((s) => (
								<option key={s.id} value={s.id}>
									{s.name} ({s.city})
								</option>
							))}
							{unlocked && <option value={0}>Only my home</option>}
						</select>
					</div>
				)}

				<DayPicker
					dayClass={(d) =>
						[
							confirmed.has(d)
								? "confirmed"
								: free.has(d)
									? "free"
									: pending.includes(d)
										? "new"
										: requested.has(d)
											? "proposed"
											: "",
							marking.anchor === d ? "anchor" : "",
						].join(" ")
					}
					isLocked={(d) => free.has(d) || confirmed.has(d)}
					onPick={marking.pick}
				>
					<div className="cal-foot">
						<div>
							<span className="cal-legend">
								<span className="cal-swatch free" /> Availability
							</span>
							<span className="cal-legend">
								<span className="cal-swatch new" /> Not published yet
							</span>
							<span className="cal-legend">
								<span className="cal-swatch confirmed" /> Guest coming
							</span>
							<span className="cal-legend">
								<span className="cal-swatch proposed" /> Requested
							</span>
						</div>
					</div>
				</DayPicker>
				<p className="hint" style={{ margin: "0.6rem 0 0" }}>
					Tap the first and the last day to mark a whole range. Tap a marked day
					to unmark it.
				</p>

				{!homeOnly && unlocked && (
					<label className="check-row">
						<input
							type="checkbox"
							checked={includeHome}
							onChange={(e) => setIncludeHome(e.target.checked)}
						/>
						🏠 Include my home too
					</label>
				)}
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={!!busy || pending.length === 0}
					onClick={() => void publish()}
				>
					{busy ||
						(pending.length === 0
							? "Tap the days your studio is available"
							: `Publish ${pending.length} ${pending.length === 1 ? "day" : "days"}`)}
				</button>
				<ErrorNotice error={error} />
				{hash && <TxNotice hash={hash} text="Done! It's saved on Stellar." />}
			</div>
		</section>
	)
}
