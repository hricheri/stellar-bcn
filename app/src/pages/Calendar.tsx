import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
	DAY,
	daysBetween,
	DayPicker,
	toRanges,
	useRangeMarking,
} from "../components/DayPicker"
import { ErrorNotice, PageTitle, TxNotice } from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"
import { useLikes } from "../hooks/useLikes"
import {
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
	type Spot,
	SPOT_OPEN,
	type Studio,
} from "../lib/tattoo"

// TATTOO APP: the days you'd like to travel. When a favorite is free on
// them (±1 day), you get a heads-up. Your studio's free days are marked in
// the Studio menu.

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
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const bookings = useBookings(address)
	const likes = useLikes()
	const travel = useTravelDays()
	const send = useSend()

	const [trip, setTrip] = useState<number[]>()
	const [busy, setBusy] = useState("")
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

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

	// My own stays as a guest
	const visits = (bookings.data ?? []).filter((b) => b.guest === address)
	const confirmed = new Set(
		visits
			.filter((b) => b.status === BK_CONFIRMED)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)
	const requested = new Set(
		visits
			.filter((b) => b.status === BK_PENDING)
			.flatMap((b) => daysBetween(Number(b.start), Number(b.end))),
	)
	const marking = useRangeMarking(tripDays, setTripDays, () => false)

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

	const tripSet = new Set(tripDays)

	return (
		<>
			<PageTitle
				title="Calendar"
				subtitle="Mark the days you'd like to travel. We'll let you know when your favorites are free then."
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
					<DayPicker
						dayClass={(d) =>
							[
								confirmed.has(d)
									? "confirmed"
									: requested.has(d)
										? "proposed"
										: "",
								tripSet.has(d) ? "travel" : "",
								marking.anchor === d ? "anchor" : "",
							].join(" ")
						}
						onPick={marking.pick}
					>
						<div className="cal-foot">
							<div>
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
						day to unmark it. They save on their own.
					</p>

					<ErrorNotice error={error} />
					{hash && <TxNotice hash={hash} text="Done! It's saved on Stellar." />}
				</div>
			</section>
		</>
	)
}

export default Calendar
