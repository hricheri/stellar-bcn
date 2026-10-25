import { useEffect, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { PublishStudio } from "../components/PublishStudio"
import { ReviewList } from "../components/ReviewList"
import { SpotCard } from "../components/SpotCard"
import {
	Avatar,
	ErrorNotice,
	HomeSwapProgress,
	PageTitle,
	RatingLine,
	TierBadge,
} from "../components/TattooUI"
import { WishlistEditor } from "../components/WishlistEditor"
import { useArtist, useReviews, useSend, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	loadWishlist,
	reputationOf,
	saveWishlist,
	type Wishlist,
} from "../lib/tattoo"

const scrollTo = (id: string) =>
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })

const RegisterForm = () => {
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const submit = async (form: FormData) => {
		setBusy(true)
		setError(undefined)
		try {
			await send((c, artist, opts) =>
				c.register_artist(
					{
						artist,
						name: String(form.get("name") ?? "").trim(),
						city: String(form.get("city") ?? "").trim(),
						instagram: String(form.get("instagram") ?? "").trim(),
					},
					opts,
				),
			)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="ts-card">
			<form className="ts-card-body" action={submit}>
				<h2 style={{ marginBottom: "0.85rem" }}>Create your artist profile</h2>
				<div className="field">
					<label htmlFor="name">Artist name</label>
					<input id="name" name="name" required maxLength={40} />
				</div>
				<div className="field-row">
					<div className="field">
						<label htmlFor="city">City of your studio</label>
						<input id="city" name="city" required maxLength={40} />
					</div>
					<div className="field">
						<label htmlFor="instagram">Instagram</label>
						<input
							id="instagram"
							name="instagram"
							placeholder="@"
							maxLength={40}
						/>
					</div>
				</div>
				<button className="btn-lime btn-block" disabled={busy}>
					{busy ? "Creating..." : "Create profile on Stellar"}
				</button>
				<ErrorNotice error={error} />
			</form>
		</section>
	)
}

const Profile = () => {
	const { address } = useWallet()
	const me = useArtist(address)
	const reviews = useReviews(address)
	const spots = useSpots()
	const [wish, setWish] = useState<Wishlist>(loadWishlist)
	const location = useLocation()
	// Links like /perfil#lo-que-busco jump to that section once it's rendered
	const section = location.hash.slice(1)
	const ready = !!me.data
	useEffect(() => {
		if (ready && section) scrollTo(section)
	}, [ready, section])

	if (!address) {
		return (
			<>
				<PageTitle title="My profile" />
				<div className="alert alert-info">
					Tap <b>Sign in</b> at the top to create your profile on testnet.
				</div>
			</>
		)
	}

	if (me.isLoading) return <div className="empty-state">Loading...</div>
	if (!me.data) {
		return (
			<>
				<PageTitle
					title="Welcome"
					subtitle="Your profile and reputation are stored on Stellar."
				/>
				<RegisterForm />
			</>
		)
	}

	const a = me.data
	const mySpots = (spots.data ?? []).filter((s) => s.host === a.address)
	const studioSpots = mySpots.filter((s) => s.kind !== "homeonly")
	const homeSpots = mySpots.filter((s) => s.kind !== "studio")
	const unlocked = reputationOf(a).home_swap_unlocked

	return (
		<>
			<section className="ts-card">
				<div className="ts-card-body">
					<div className="host-row">
						<Avatar artist={a} big />
						<div style={{ flex: 1 }}>
							<h1 style={{ fontSize: "1.8rem" }}>{a.name}</h1>
							<div
								className="meta"
								style={{ color: "var(--lavender-700)", fontWeight: 700 }}
							>
								{a.city} · {a.instagram}
							</div>
							<div
								style={{
									display: "flex",
									gap: "0.5rem",
									alignItems: "center",
									marginTop: "0.25rem",
									flexWrap: "wrap",
								}}
							>
								<TierBadge artist={a} />
								<RatingLine artist={a} />
							</div>
						</div>
					</div>
					<div style={{ marginTop: "1rem" }}>
						<HomeSwapProgress artist={a} />
					</div>
					<div className="field-row" style={{ marginTop: "1rem" }}>
						<button
							className="btn-lime btn-block"
							style={{ flex: 1 }}
							onClick={() => scrollTo("mi-estudio")}
						>
							My studio
						</button>
						<button
							className="btn-ghost btn-block"
							style={{ flex: 1 }}
							onClick={() => scrollTo("availability")}
						>
							Availability
						</button>
						<button
							className="btn-ghost btn-block"
							style={{ flex: 1 }}
							onClick={() => scrollTo("mi-hogar")}
						>
							My home
						</button>
						<button
							className="btn-ghost btn-block"
							style={{ flex: 1 }}
							onClick={() => scrollTo("lo-que-busco")}
						>
							What I'm looking for
						</button>
						<Link to="/clientes" style={{ flex: 1 }}>
							<button className="btn-ghost btn-block">Client QR</button>
						</Link>
						<Link to={`/artista/${a.address}`} style={{ flex: 1 }}>
							<button className="btn-ghost btn-block">Public view</button>
						</Link>
					</div>
				</div>
			</section>

			<div className="ts-card">
				<div
					className="ts-card-body"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: "0.75rem",
						flexWrap: "wrap",
					}}
				>
					<span>
						Your matches, swaps, chats and calendar are all in one place.
					</span>
					<Link to="/swaps">
						<button className="btn-lavender">Go to my swaps</button>
					</Link>
				</div>
			</div>

			<div className="split-title" id="mi-estudio">
				<h2>My studio</h2>
				<span className="hint">A studio can have several artists</span>
			</div>
			<PublishStudio me={a} />
			{studioSpots.length > 0 && (
				<div className="split-title">
					<h2>My studio's free dates</h2>
				</div>
			)}
			{studioSpots.map((s) => (
				<SpotCard key={s.id} spot={s} host={a} me={a} />
			))}

			<div className="split-title" id="mi-hogar">
				<h2>My home</h2>
				<span className="hint">Only for established artists</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					{unlocked ? (
						<p style={{ margin: 0 }}>
							You can now offer your home: with your studio, or only your home
							if you don't have a studio. Choose it in <b>Availability</b>,
							above.
						</p>
					) : (
						<>
							<p style={{ marginTop: 0 }}>
								Offering your home unlocks once you're established.
							</p>
							<HomeSwapProgress artist={a} />
						</>
					)}
				</div>
			</section>
			{homeSpots.map((s) => (
				<SpotCard key={s.id} spot={s} host={a} me={a} />
			))}

			<div className="split-title" id="lo-que-busco">
				<h2>What I'm looking for</h2>
				<span className="hint">This is what the match % is based on</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<WishlistEditor
						wish={wish}
						onChange={(next) => {
							setWish(next)
							saveWishlist(next)
						}}
					/>
				</div>
			</section>

			<div className="split-title">
				<h2>My reviews</h2>
				<span className="hint">Stored on Stellar, nobody can delete them</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<ReviewList reviews={reviews.data ?? []} />
				</div>
			</section>
		</>
	)
}

export default Profile
