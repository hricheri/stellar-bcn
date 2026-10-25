import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { DAY, daysBetween, DayPicker, toRanges } from "../components/DayPicker"
import { ErrorNotice, PageTitle, TxNotice } from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"
import { useLikes } from "../hooks/useLikes"
import {
	useArtist,
	useArtists,
	useBookings,
	useSend,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useTravelDays } from "../hooks/useTrips"
import { useWallet } from "../hooks/useWallet"
import {
	BK_CONFIRMED,
	BK_PENDING,
	formatRange,
	reputationOf,
	type Spot,
	SPOT_OPEN,
	type Studio,
} from "../lib/tattoo"

// TATTOO APP: the heart of the app. Mark the days your studio is free (they
// go to Stellar and show up in Explore) and the days you'd like to travel.
// When a favorite is free on your travel days (±1 day), you get a heads-up.

type Mode = "free" | "travel"

/** Range marking: tap the first and last day; tap a marked day to unmark it */
const useRangeMarking = (
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

/** A favorite that's free on one of my trips */
interface Alert {
	key: string
	spot: Spot
	studio?: Studio
	name: string
	trip: { start: number; end: number }
}

const Calendar = () => {
	const { address } = useWallet()
	const { ready, session } = useAuth()
	const me = useArtist(address)
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const bookings = useBookings(address)
	const likes = useLikes()
	const travel = useTravelDays()
	const send = useSend()

	const [mode, setMode] = useState<Mode>("free")
	const [studioId, setStudioId] = useState<number>()
	const [includeHome, setIncludeHome] = useState(false)
	const [pending, setPending] = useState<number[]>([])
	const [trip, setTrip] = useState<number[]>()
	const [busy, setBusy] = useState("")
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	const myStudios = (studios.data ?? []).filter(
		(s) => !!address && s.members.includes(address),
	)
	const unlocked = me.data ? reputationOf(me.data).home_swap_unlocked : false
	// 0 = only my home
	const selected = studioId ?? myStudios[0]?.id ?? 0
	const homeOnly = selected === 0

	// Travel days: edited here, saved a moment after the last tap
	const tripDays = trip ?? travel.days
	const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
	useEffect(() => () => clearTimeout(saveTimer.current), [])
	const setTripDays = (days: number[]) => {
		setTrip(days)
		clearTimeout(saveTimer.current)
		saveTimer.current = setTimeout(() => {
			travel.save(days).catch((e: Error) => setError(e.message))
		}, 700)
	}

	// What's already on Stellar for the selected studio (or my home)
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
	const confirmed = new Set(
		(bookings.data ?? [])
			.filter((b) => b.status === BK_CONFIRMED)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)
	const requested = new Set(
		(bookings.data ?? [])
			.filter((b) => b.status === BK_PENDING)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)

	const freeMarking = useRangeMarking(
		pending,
		setPending,
		(d) => free.has(d) || confirmed.has(d),
	)
	const travelMarking = useRangeMarking(tripDays, setTripDays, () => false)
	const marking = mode === "free" ? freeMarking : travelMarking

	// Favorites free on my trips, give or take a day
	const alerts = useMemo<Alert[]>(() => {
		const liked = new Set(likes.data ?? [])
		const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
		const out: Alert[] = []
		for (const r of toRanges(tripDays)) {
			const end = r.end - (r.end % DAY)
			for (const s of spots.data ?? []) {
				if (s.status !== SPOT_OPEN) continue
				const studio = (studios.data ?? []).find((st) => st.id === s.studio_id)
				const people = studio ? studio.members : [s.host]
				if (!people.some((p) => liked.has(p))) continue
				if (Number(s.start) <= r.start + DAY && Number(s.end) >= end - DAY)
					out.push({
						key: `${s.id}-${r.start}`,
						spot: s,
						studio,
						name: studio?.name ?? `${byAddress.get(s.host)?.name}'s home`,
						trip: {
							start: Math.max(r.start, Number(s.start)),
							end: Math.min(end, Number(s.end)),
						},
					})
			}
		}
		return out
	}, [tripDays, spots.data, studios.data, likes.data, artists.data])

	if (!address)
		return (
			<>
				<PageTitle title="Calendar" />
				<div className="alert alert-info">
					{ready && !session ? (
						<>
							<Link to="/entrar">Sign in</Link> to mark your dates.
						</>
					) : (
						"Getting your account ready..."
					)}
				</div>
			</>
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

	const request = async (a: Alert) => {
		if (!a.studio) return
		setBusy(a.key)
		setError(undefined)
		try {
			const end = a.trip.end > a.trip.start ? a.trip.end : a.trip.start + 1
			const { hash } = await send((c, guest, o) =>
				c.propose_dates(
					{
						guest,
						studio_id: a.studio!.id,
						start: BigInt(a.trip.start),
						end: BigInt(end),
					},
					o,
				),
			)
			setHash(hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy("")
		}
	}

	const canPublish = myStudios.length > 0 || unlocked
	const tripSet = new Set(tripDays)

	return (
		<>
			<PageTitle
				title="Calendar"
				subtitle="Mark when your studio is free and when you'd like to travel. Everything in the app follows these dates."
			/>

			{alerts.length > 0 && (
				<section className="ts-card trip-alerts">
					<div className="ts-card-body">
						<h3>✈ Your favorites are free on your trip</h3>
						{alerts.map((a) => (
							<div key={a.key} className="trip-alert">
								<div style={{ flex: 1 }}>
									<b>{a.name}</b> · {a.spot.city}
									<div className="hint">
										{formatRange(a.trip.start, a.trip.end)}
									</div>
								</div>
								{a.studio && (
									<button
										className="btn-lime"
										disabled={!!busy}
										onClick={() => void request(a)}
									>
										{busy === a.key ? "..." : "Request"}
									</button>
								)}
							</div>
						))}
					</div>
				</section>
			)}

			<section className="ts-card">
				<div className="ts-card-body">
					<div className="filter-grid" style={{ marginBottom: "1rem" }}>
						<button
							className={`filter-btn${mode === "free" ? " on" : ""}`}
							onClick={() => {
								setMode("free")
								marking.reset()
							}}
						>
							My studio is free
						</button>
						<button
							className={`filter-btn travel${mode === "travel" ? " on" : ""}`}
							onClick={() => {
								setMode("travel")
								marking.reset()
							}}
						>
							I want to travel
						</button>
					</div>

					{mode === "free" && !canPublish && (
						<div className="alert alert-info">
							First <Link to="/perfil#mi-estudio">create your studio</Link> in
							your profile to publish its free days.
						</div>
					)}
					{mode === "free" &&
						canPublish &&
						(myStudios.length > 1 || unlocked) && (
							<div className="field">
								<select
									aria-label="Studio"
									value={selected}
									onChange={(e) => {
										setStudioId(Number(e.target.value))
										setPending([])
									}}
								>
									{myStudios.map((s) => (
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
								tripSet.has(d) ? "travel" : "",
								marking.anchor === d ? "anchor" : "",
							].join(" ")
						}
						isLocked={(d) =>
							mode === "free"
								? !canPublish || free.has(d) || confirmed.has(d)
								: false
						}
						onPick={marking.pick}
					>
						<div className="cal-foot">
							<div>
								<span className="cal-legend">
									<span className="cal-swatch free" /> Studio free
								</span>
								<span className="cal-legend">
									<span className="cal-swatch new" /> Not published yet
								</span>
								<span className="cal-legend">
									<span className="cal-swatch travel" /> I want to travel
								</span>
								<span className="cal-legend">
									<span className="cal-swatch confirmed" /> Confirmed stay
								</span>
								<span className="cal-legend">
									<span className="cal-swatch proposed" /> Requested
								</span>
							</div>
						</div>
					</DayPicker>
					<p className="hint" style={{ margin: "0.6rem 0 0" }}>
						Tap the first and the last day to mark a whole range. Tap a marked
						day to unmark it.
						{mode === "travel" && " Travel days save on their own."}
					</p>

					{mode === "free" && canPublish && (
						<>
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
								{busy && !alerts.some((a) => a.key === busy)
									? busy
									: pending.length === 0
										? "Tap the days your studio is free"
										: `Publish ${pending.length} ${pending.length === 1 ? "day" : "days"}`}
							</button>
						</>
					)}
					<ErrorNotice error={error} />
					{hash && <TxNotice hash={hash} text="Done! It's saved on Stellar." />}
				</div>
			</section>
		</>
	)
}

export default Calendar
