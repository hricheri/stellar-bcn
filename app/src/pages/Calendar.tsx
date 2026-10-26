import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
	DAY,
	daysBetween,
	DayPicker,
	todayUnix,
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

// TATTOO APP: the days you'd like to travel, and your favorites' free days
// next to them: the ones that fall on your days first, then the others, so
// you can move your days to match. Your studio's free days are marked in
// the Studio menu.

/** Free dates of a favorite, and which of them are on my days */
interface Alert {
	key: string
	spot: Spot
	studio?: Studio
	name: string
	/** Their free days from today on */
	days: number[]
	/** The ones I can travel */
	match: number[]
	/** What a Request asks for: the first run of matching days */
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
	// "📅 10 - 30 Nov" on a stay opens its month
	const [params] = useSearchParams()
	const month = Number(params.get("month")) || undefined
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

	// I already asked this studio for these days
	const asked = (a: Alert) =>
		visits.some(
			(b) =>
				b.status === BK_PENDING &&
				b.studio_id === a.studio?.id &&
				Number(b.start) <= a.trip.end &&
				Number(b.end) >= a.trip.start,
		)

	// Every free date of my favorites, the ones on my days first
	const alerts = useMemo<Alert[]>(() => {
		const liked = new Set(likes.data ?? [])
		const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
		const mine = new Set(tripDays)
		const today = todayUnix()
		const out: Alert[] = []
		for (const s of spots.data ?? []) {
			if (s.status !== SPOT_OPEN) continue
			const studio = (studios.data ?? []).find((st) => st.id === s.studio_id)
			const people = studio ? studio.members : [s.host]
			if (!people.some((p) => liked.has(p))) continue
			const days = daysBetween(Number(s.start), Number(s.end)).filter(
				(d) => d >= today,
			)
			if (days.length === 0) continue
			const match = days.filter((d) => mine.has(d))
			const run = toRanges(match)[0]
			out.push({
				key: String(s.id),
				spot: s,
				studio,
				name: studio?.name ?? `${byAddress.get(s.host)?.name}'s home`,
				days,
				match,
				trip: run
					? { start: run.start, end: run.end - (run.end % DAY) }
					: { start: days[0]!, end: days[days.length - 1]! },
			})
		}
		return out.sort(
			(x, y) =>
				Number(y.match.length > 0) - Number(x.match.length > 0) ||
				x.days[0]! - y.days[0]!,
		)
	}, [tripDays, spots.data, studios.data, likes.data, artists.data])
	const favoritesFree = new Set(alerts.flatMap((a) => a.days))
	const matching = alerts.filter((a) => a.match.length > 0)
	// "See" on a date that doesn't match: the calendar jumps to its month
	const [shown, setShown] = useState<number>()

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
						<h3>
							{matching.length > 0
								? "✈ One of your favorites is available!"
								: "Your favorites' available dates"}
						</h3>
						{matching.length === 0 && (
							<p className="hint" style={{ marginTop: 0 }}>
								None of them falls on your days yet. Mark days that match to ask
								for them.
							</p>
						)}
						{alerts.map((a) => (
							<div key={a.key} className="trip-alert">
								<div style={{ flex: 1 }}>
									<b>{a.name}</b> · {a.spot.city}
									<div className="hint">
										{formatRange(a.days[0]!, a.days[a.days.length - 1]!)}
										{a.match.length > 0
											? ` · ✈️ ${a.match.length} ${a.match.length === 1 ? "day matches" : "days match"} yours`
											: " · not on your days"}
									</div>
								</div>
								{a.match.length === 0 ? (
									<button
										className="btn-ghost"
										onClick={() => setShown(a.days[0])}
									>
										See
									</button>
								) : (
									a.studio &&
									(asked(a) ? (
										<span className="pill pill-gray">
											⏳ Waiting confirmation
										</span>
									) : (
										<button
											className="btn-lime"
											disabled={!!busy}
											title={`Asks for ${formatRange(a.trip.start, a.trip.end)}`}
											onClick={() => void request(a)}
										>
											{busy === a.key ? "..." : "Request"}
										</button>
									))
								)}
							</div>
						))}
					</div>
				</section>
			)}

			<section className="ts-card trip-cal">
				<div className="ts-card-body">
					<DayPicker
						key={shown}
						startMonth={shown ?? month}
						dayClass={(d) =>
							[
								confirmed.has(d)
									? "confirmed"
									: requested.has(d)
										? "proposed"
										: favoritesFree.has(d)
											? "free"
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
								<span className="cal-legend">
									<span className="cal-swatch free" /> Favorites' availability
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
