import { useState } from "react"
import { Link } from "react-router-dom"
import { AccessView } from "../components/Access"
import { BookingActions } from "../components/BookingActions"
import { Chat } from "../components/Chat"
import { MyStudioCard } from "../components/MyStudioCard"
import { Avatar, PageTitle, Photo } from "../components/TattooUI"
import { OfferDates, requestRange } from "../components/VisitRequest"
import { useAuth } from "../hooks/useAuth"
import { useProfiles, useStudioImage } from "../hooks/useProfiles"
import {
	useArtist,
	useArtists,
	useBookings,
	useSpots,
	useStudios,
} from "../hooks/useTattoo"
import { useVisitRequests } from "../hooks/useVisitRequests"
import { useWallet } from "../hooks/useWallet"
import {
	type Artist,
	BK_COMPLETED,
	BK_CONFIRMED,
	BK_DECLINED,
	BK_PENDING,
	type Booking,
	formatDate,
	formatRange,
	pendingActions,
	promoDeadline,
	type Studio,
} from "../lib/tattoo"

// TATTOO APP: Guest = the studios I asked to visit. Studio = the artists who
// want to come to mine. Each stay goes requested -> confirmed -> past.

type Side = "guest" | "studio"

const COPY: Record<
	Side,
	{
		title: string
		subtitle: string
		groups: { pending: string; confirmed: string; past: string }
		empty: React.ReactNode
	}
> = {
	guest: {
		title: "Guest",
		subtitle: "The studios you asked to visit, from request to review.",
		groups: {
			pending: "Waiting for the studio",
			confirmed: "✈️ Confirmed",
			past: "Past visits",
		},
		empty: (
			<>
				No visits yet. Find a studio in <Link to="/">Explore</Link> and tap its
				calendar to ask for your dates.
			</>
		),
	},
	studio: {
		title: "Studio",
		subtitle: "Artists who want to come to your studio.",
		groups: {
			pending: "Requests for you",
			confirmed: "🏠 Coming guests",
			past: "Past guests",
		},
		empty: (
			<>
				No requests yet. Tap Add availability on your studio so guests can find
				you.
			</>
		),
	},
}

const StayRow = ({
	b,
	side,
	me,
	other,
	studio,
	city,
	home,
}: {
	b: Booking
	side: Side
	me: string
	other?: Artist
	studio?: Studio
	city: string
	/** The stay includes the host's home */
	home: boolean
}) => {
	const [open, setOpen] = useState<"chat" | "details">()
	const image = useStudioImage(studio)
	const toDo = pendingActions(
		b,
		me,
		side === "studio" && b.status === BK_PENDING,
	).filter((a) => a !== "esperando_host")

	return (
		<div className="stay-row">
			<div className="stay-main">
				{side === "guest" ? (
					<div className="stay-thumb">
						<Photo
							key={image}
							src={image}
							alt={studio?.name ?? city}
							fallback={<div className="cover-fallback" />}
						/>
					</div>
				) : (
					other && <Avatar artist={other} big />
				)}
				<div style={{ flex: 1, minWidth: 0 }}>
					<div className="stay-city">{city}</div>
					<div className="meta">
						{side === "guest"
							? `${studio?.name ?? "Home"}${other ? ` · ${other.name}` : ""}`
							: (other?.name ?? "A guest")}
					</div>
					<div className="meta">📅 {formatRange(b.start, b.end)}</div>
				</div>
				{toDo.length > 0 && <span className="dot-alert" title="To do" />}
			</div>
			<div className="card-actions">
				{other && (
					<button
						className={`btn-ghost${open === "chat" ? " on" : ""}`}
						onClick={() => setOpen(open === "chat" ? undefined : "chat")}
					>
						💬 Chat
					</button>
				)}
				{b.status === BK_CONFIRMED && (
					<button
						className="btn-ghost"
						onClick={() => setOpen(open === "details" ? undefined : "details")}
					>
						{open === "details" ? "Hide details" : "View details"}
					</button>
				)}
				{other && (
					<Link to={`/artista/${other.address}`} className="btn-ghost">
						Profile
					</Link>
				)}
			</div>
			{open === "details" && (
				<div className="swap-details">
					<div>
						<b>Where:</b> {studio ? `${studio.name}, ${city}` : city}
					</div>
					<div>
						<b>When:</b> {formatRange(b.start, b.end)}
					</div>
					{side === "guest" ? (
						<AccessView host={b.host} studioId={b.studio_id} home={home} />
					) : (
						<p className="hint">
							Your guest sees your address and access instructions from your
							profile. Anything else, tell them in the chat.
						</p>
					)}
					{(b.host === me ? b.host_promo_sent : b.guest_promo_sent) ? (
						<div className="alert alert-ok">✓ You posted the graphic.</div>
					) : (
						<div className="alert alert-info">
							📸 Post the guest artist graphic before{" "}
							{formatDate(promoDeadline(b.start))}, so clients know the dates.
						</div>
					)}
				</div>
			)}
			<div style={{ marginTop: "0.5rem" }}>
				<BookingActions booking={b} me={me} other={other} />
			</div>
			{open === "chat" && other && (
				<div style={{ marginTop: "0.75rem" }}>
					<Chat me={me} other={other} canChat />
				</div>
			)}
		</div>
	)
}

/** "I want to visit!" requests: sent ones (Guest) or received ones (Studio) */
const VisitRequests = ({ side }: { side: Side }) => {
	const { userId } = useAuth()
	const requests = useVisitRequests()
	const profiles = useProfiles()
	const artists = useArtists()
	const studios = useStudios()
	const byId = new Map(
		[...(profiles.data?.values() ?? [])].map((p) => [p.id, p]),
	)
	const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
	const mine = (requests.data ?? []).filter((r) =>
		side === "guest"
			? r.guest === userId && r.status !== "closed"
			: r.host === userId && r.status === "open",
	)
	if (mine.length === 0) return null

	return (
		<div>
			<div className="split-title">
				<h2>{side === "guest" ? "✈ Visit requests" : "✈ Want to visit you"}</h2>
				<span className="hint">{mine.length}</span>
			</div>
			<div className="ts-card">
				{mine.map((r) => {
					const other = byId.get(side === "guest" ? r.host : r.guest)
					const artist = other?.stellar_address
						? byAddress.get(other.stellar_address)
						: undefined
					const studio = (studios.data ?? []).find((s) => s.id === r.studio_id)
					const dates = requestRange(r)
					return (
						<div key={r.id} className="stay-row">
							<div className="stay-main">
								{artist && <Avatar artist={artist} big />}
								<div style={{ flex: 1, minWidth: 0 }}>
									<div className="stay-city">
										{side === "guest"
											? (studio?.city ?? "")
											: (other?.name ?? "An artist")}
									</div>
									<div className="meta">
										{side === "guest"
											? `${studio?.name ?? "Studio"}${other ? ` · ${other.name}` : ""}`
											: `${other?.city ?? ""} → ${studio?.name ?? "your studio"}`}
									</div>
									<div className="meta">📅 {dates ?? "Flexible dates"}</div>
								</div>
								{side === "studio" && (
									<span className="dot-alert" title="To do" />
								)}
							</div>
							{r.message && <p className="visit-msg">“{r.message}”</p>}
							{side === "studio" ? (
								<OfferDates r={r} />
							) : r.status === "answered" ? (
								<div className="alert alert-info">
									🎉 {studio?.name ?? "The studio"} offered you dates.{" "}
									{artist && (
										<Link to={`/artista/${artist.address}`}>Pick yours →</Link>
									)}
								</div>
							) : (
								<span className="pill pill-outline">
									⏳ Waiting for the studio to offer dates
								</span>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}

const Stays = ({ side }: { side: Side }) => {
	const { address } = useWallet()
	const { ready, session } = useAuth()
	const me = useArtist(address)
	const artists = useArtists()
	const studios = useStudios()
	const spots = useSpots()
	const bookings = useBookings(address)
	const copy = COPY[side]

	if (!address || !me.data)
		return (
			<>
				<PageTitle title={copy.title} subtitle={copy.subtitle} />
				<div className="alert alert-info">
					{ready && !session ? (
						<>
							<Link to="/entrar">Sign in</Link> to see your visits.
						</>
					) : (
						<>
							First <Link to="/perfil">create your profile</Link>.
						</>
					)}
				</div>
			</>
		)

	const byAddress = new Map((artists.data ?? []).map((a) => [a.address, a]))
	const mine = (bookings.data ?? []).filter(
		(b) =>
			b.status !== BK_DECLINED &&
			(side === "guest" ? b.guest === address : b.guest !== address),
	)
	const groups = {
		pending: mine.filter((b) => b.status === BK_PENDING),
		confirmed: mine.filter((b) => b.status === BK_CONFIRMED),
		past: mine.filter((b) => b.status === BK_COMPLETED),
	}

	const row = (b: Booking) => {
		const studio = (studios.data ?? []).find((s) => s.id === b.studio_id)
		const spot = (spots.data ?? []).find((s) => s.id === b.spot_id)
		const other = byAddress.get(side === "guest" ? b.host : b.guest)
		return (
			<StayRow
				key={b.id}
				b={b}
				side={side}
				me={address}
				other={other}
				studio={studio}
				city={studio?.city ?? spot?.city ?? other?.city ?? ""}
				home={!!spot && spot.kind !== "studio"}
			/>
		)
	}

	return (
		<>
			<PageTitle title={copy.title} subtitle={copy.subtitle} />
			{side === "studio" && <MyStudioCard me={address} />}
			<VisitRequests side={side} />
			{mine.length === 0 && (
				<div className="ts-card empty-state">{copy.empty}</div>
			)}
			{(["pending", "confirmed", "past"] as const).map(
				(g) =>
					groups[g].length > 0 && (
						<div key={g}>
							<div className="split-title">
								<h2>{copy.groups[g]}</h2>
								<span className="hint">{groups[g].length}</span>
							</div>
							<div
								className={`ts-card${g === "confirmed" ? " swap-confirmed" : ""}`}
							>
								{[...groups[g]]
									.sort((x, y) =>
										g === "past"
											? Number(y.start) - Number(x.start)
											: Number(x.start) - Number(y.start),
									)
									.map(row)}
							</div>
						</div>
					),
			)}
		</>
	)
}

export default Stays
