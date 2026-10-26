import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
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
	type Booking,
	BK_CONFIRMED,
	BK_PENDING,
	formatRange,
	isDropped,
	SPOT_OPEN,
} from "../lib/tattoo"

// TATTOO APP: the days you'd like to travel, your favorites' free days next
// to them, and the guest spots you asked for. Tap one of your requests to
// see it on the calendar and change the days you asked for.

/** A request of mine, with the studio it's asking */
interface Request {
	booking: Booking
	name: string
	city: string
	/** The studio's own free days, so I can add or drop days */
	free: number[]
	days: number[]
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
	// The request I'm looking at on the calendar, and the days it asks for
	const [openId, setOpenId] = useState<number>()
	const [picked, setPicked] = useState<number[]>()

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
	const visits = (bookings.data ?? []).filter(
		(b) => b.guest === address && !isDropped(b),
	)
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

	// What I asked for, newest first
	const requests = useMemo<Request[]>(() => {
		const today = todayUnix()
		const open = (spots.data ?? []).filter((s) => s.status === SPOT_OPEN)
		return visits
			.filter((b) => Number(b.end) >= today)
			.map((b) => {
				const studio = (studios.data ?? []).find((s) => s.id === b.studio_id)
				const host = (artists.data ?? []).find((a) => a.address === b.host)
				return {
					booking: b,
					name: studio?.name ?? `${host?.name ?? "An artist"}'s home`,
					city: studio?.city ?? host?.city ?? "",
					free: open
						.filter((s) => s.studio_id === b.studio_id)
						.flatMap((s) => daysBetween(Number(s.start), Number(s.end)))
						.filter((d) => d >= today),
					days: daysBetween(Number(b.start), Number(b.end)),
				}
			})
			.sort((x, y) => x.days[0]! - y.days[0]!)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [bookings.data, studios.data, artists.data, spots.data, address])

	// Free days of my favorites, so I can see when it's worth travelling
	const favoritesFree = useMemo(() => {
		const liked = new Set(likes.data ?? [])
		const today = todayUnix()
		const days = new Set<number>()
		for (const s of spots.data ?? []) {
			if (s.status !== SPOT_OPEN) continue
			const studio = (studios.data ?? []).find((st) => st.id === s.studio_id)
			const people = studio ? studio.members : [s.host]
			if (!people.some((p) => liked.has(p))) continue
			for (const d of daysBetween(Number(s.start), Number(s.end)))
				if (d >= today) days.add(d)
		}
		return days
	}, [spots.data, studios.data, likes.data])

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

	const open = requests.find((r) => r.booking.id === openId)
	const openDays = picked ?? open?.days ?? []
	const openFree = new Set(open?.free ?? [])
	const openSet = new Set(openDays)
	const changed =
		!!open &&
		(openDays.length !== open.days.length ||
			open.days.some((d) => !openSet.has(d)))

	const show = (r: Request) => {
		const same = openId === r.booking.id
		setOpenId(same ? undefined : r.booking.id)
		setPicked(undefined)
		setHash(undefined)
		setError(undefined)
	}

	// Their free days and the ones I already asked for can be tapped
	const pickDay = (d: number) => {
		if (!open) return
		setHash(undefined)
		setPicked(
			openSet.has(d)
				? openDays.filter((x) => x !== d)
				: [...openDays, d].sort((a, b) => a - b),
		)
	}

	const update = async () => {
		if (!open) return
		const run = toRanges(openDays)[0]
		if (!run) return
		setBusy("update")
		setError(undefined)
		try {
			const { hash } = await send((c, guest, o) =>
				c.change_request(
					{
						guest,
						booking_id: open.booking.id,
						start: BigInt(run.start),
						end: BigInt(run.end),
					},
					o,
				),
			)
			setHash(hash || "done")
			setPicked(undefined)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy("")
		}
	}

	const cancel = async () => {
		if (!open) return
		setBusy("cancel")
		setError(undefined)
		try {
			const { hash } = await send((c, guest, o) =>
				c.cancel_request({ guest, booking_id: open.booking.id }, o),
			)
			setHash(hash || "done")
			setOpenId(undefined)
			setPicked(undefined)
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
				subtitle="Mark the days you'd like to travel. We'll let you know when your favorites are available then."
			/>

			{requests.length > 0 && (
				<section className="ts-card trip-alerts">
					<div className="ts-card-body">
						<h3>✈ Guest spots I asked for</h3>
						{requests.map((r) => {
							const pending = r.booking.status === BK_PENDING
							return (
								<div
									key={r.booking.id}
									className={`trip-alert${openId === r.booking.id ? " on" : ""}`}
								>
									<button className="trip-alert-main" onClick={() => show(r)}>
										<b>{r.name}</b> · {r.city}
										<div className="hint">
											{formatRange(r.days[0]!, r.days[r.days.length - 1]!)}
										</div>
									</button>
									<span
										className={`pill ${pending ? "pill-gray" : "pill-dark"}`}
									>
										{pending ? "⏳ Waiting confirmation" : "✓ Confirmed"}
									</span>
									<Link
										to="/guest"
										className="btn-ghost"
										title="Follow it up in the chat"
									>
										💬
									</Link>
								</div>
							)
						})}
					</div>
				</section>
			)}

			<section className="ts-card trip-cal">
				<div className="ts-card-body">
					{open && (
						<div className="split-title" style={{ marginBottom: "0.5rem" }}>
							<div className="section-label" style={{ margin: 0 }}>
								{open.name} · {open.city}
							</div>
							<button
								className="btn-ghost"
								onClick={() => setOpenId(undefined)}
							>
								✕
							</button>
						</div>
					)}
					<DayPicker
						key={openId ?? month ?? 0}
						startMonth={open?.days[0] ?? month}
						dayClass={(d) =>
							open
								? [
										openSet.has(d)
											? "proposed"
											: openFree.has(d)
												? "theirs"
												: "",
										tripSet.has(d) ? "travel" : "",
									].join(" ")
								: [
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
						isLocked={
							open ? (d) => !openFree.has(d) && !openSet.has(d) : undefined
						}
						onPick={open ? pickDay : marking.pick}
					>
						<div className="cal-foot">
							<div>
								{open ? (
									<>
										<span className="cal-legend">
											<span className="cal-swatch proposed" /> Days I asked for
										</span>
										<span className="cal-legend">
											<span className="cal-swatch theirs" /> Their studio
											availability
										</span>
									</>
								) : (
									<>
										<span className="cal-legend">
											<span className="cal-swatch travel" /> Available to guest
										</span>
										<span className="cal-legend">
											<span className="cal-swatch confirmed" /> Confirmed Guest
											Spot
										</span>
										<span className="cal-legend">
											<span className="cal-swatch proposed" /> Requested
										</span>
										<span className="cal-legend">
											<span className="cal-swatch free" /> Favorites'
											availability
										</span>
									</>
								)}
							</div>
						</div>
					</DayPicker>
					{open ? (
						<>
							<p className="hint" style={{ margin: "0.6rem 0" }}>
								{open.booking.status === BK_PENDING
									? toRanges(openDays).length > 1
										? "Your days have a gap. Only the first run will be asked for."
										: "Tap their available days to add them to your request, or tap yours to drop them."
									: "This stay is already confirmed. Write to them in the chat to change it."}
							</p>
							{open.booking.status === BK_PENDING && (
								<div className="card-actions">
									<button
										className="btn-lime"
										disabled={!!busy || !changed || openDays.length === 0}
										onClick={() => void update()}
									>
										{busy === "update" ? "Saving..." : "Update my request"}
									</button>
									<button
										className="btn-ghost"
										disabled={!!busy}
										onClick={() => void cancel()}
									>
										{busy === "cancel" ? "..." : "Cancel my request"}
									</button>
								</div>
							)}
						</>
					) : (
						<p className="hint" style={{ margin: "0.6rem 0 0" }}>
							Tap the first and the last day to mark a whole range. Tap a marked
							day to unmark it. They save on their own.
						</p>
					)}

					<ErrorNotice error={error} />
					{hash && <TxNotice hash={hash} text="Done! It's saved on Stellar." />}
				</div>
			</section>
		</>
	)
}

export default Calendar
