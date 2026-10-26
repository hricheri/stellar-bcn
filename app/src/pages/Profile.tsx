import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { AccessEditor } from "../components/Access"
import { AmenityPicker } from "../components/AmenityPicker"
import { PhotoPicker } from "../components/PhotoPicker"
import { PublishStudio } from "../components/PublishStudio"
import { ReviewList } from "../components/ReviewList"
import {
	Avatar,
	ErrorNotice,
	PageTitle,
	RatingLine,
	TierBadge,
} from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"
import { usePhotoUrl } from "../hooks/useProfiles"
import { useArtist, useReviews, useSend, useStudios } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { must, type Profile as ProfileRow, supabase } from "../lib/supabase"
import {
	HOME_SWAP_MIN_REVIEWS,
	loadWishlist,
	reputationOf,
	saveWishlist,
} from "../lib/tattoo"

// TATTOO APP: My profile, ordered like the Sprint 4: about you, your studio,
// what you need and your home. Photos and bio are private (Supabase); name,
// city and reputation live on Stellar.

const scrollTo = (id: string) =>
	document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })

/** First time: photo, name, city, Instagram and bio */
const RegisterForm = ({ registered }: { registered: boolean }) => {
	const { userId, profile, ready } = useAuth()
	const { address } = useWallet()
	const send = useSend()
	const queryClient = useQueryClient()
	const [avatar, setAvatar] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const submit = async (form: FormData) => {
		const field = (k: string) => String(form.get(k) ?? "").trim()
		setBusy(true)
		setError(undefined)
		try {
			if (ready && userId) {
				const row = {
					name: field("name"),
					city: field("city"),
					instagram: field("instagram"),
					bio: field("bio"),
					avatar_path: avatar,
					wanted: loadWishlist().wanted,
				}
				must(
					profile
						? await supabase.from("profiles").update(row).eq("id", userId)
						: await supabase.from("profiles").insert({ id: userId, ...row }),
				)
				if (address) must(await supabase.rpc("claim_my_address", { address }))
				await queryClient.invalidateQueries({ queryKey: ["profile"] })
			}
			if (!registered)
				await send((c, artist, opts) =>
					c.register_artist(
						{
							artist,
							name: field("name"),
							city: field("city"),
							instagram: field("instagram"),
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
				<h2 style={{ marginBottom: "0.85rem" }}>About you</h2>
				{ready && (
					<div className="field">
						<PhotoPicker
							name="avatar"
							previous={avatar}
							label={avatar ? "✓ Photo ready · change" : "📷 Add your photo"}
							maxSide={800}
							onUploaded={setAvatar}
						/>
					</div>
				)}
				<div className="field">
					<label htmlFor="name">Artist name</label>
					<input
						id="name"
						name="name"
						required
						maxLength={40}
						defaultValue={profile?.name}
					/>
				</div>
				<div className="field-row">
					<div className="field">
						<label htmlFor="city">Your city</label>
						<input
							id="city"
							name="city"
							required
							maxLength={40}
							defaultValue={profile?.city}
						/>
					</div>
					<div className="field">
						<label htmlFor="instagram">Instagram</label>
						<input
							id="instagram"
							name="instagram"
							placeholder="@"
							maxLength={40}
							defaultValue={profile?.instagram}
						/>
					</div>
				</div>
				{ready && (
					<div className="field">
						<label htmlFor="bio">About you</label>
						<textarea
							id="bio"
							name="bio"
							rows={3}
							maxLength={500}
							placeholder="Your style, how long you've been tattooing, what you're looking for..."
							defaultValue={profile?.bio}
						/>
					</div>
				)}
				<button className="btn-lime btn-block" disabled={busy || !address}>
					{busy ? "Saving..." : !address ? "Getting ready..." : "Save profile"}
				</button>
				<ErrorNotice error={error} />
			</form>
		</section>
	)
}

/** Edit the private part of the profile: photo, Instagram and bio */
const EditAbout = ({
	row,
	onDone,
}: {
	row: ProfileRow
	onDone: () => void
}) => {
	const queryClient = useQueryClient()
	const [name, setName] = useState(row.name)
	const [city, setCity] = useState(row.city)
	const [bio, setBio] = useState(row.bio)
	const [instagram, setInstagram] = useState(row.instagram)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const save = async (patch: Partial<ProfileRow>) => {
		must(await supabase.from("profiles").update(patch).eq("id", row.id))
		await queryClient.invalidateQueries({ queryKey: ["profile"] })
		await queryClient.invalidateQueries({ queryKey: ["profiles"] })
	}

	return (
		<div style={{ marginTop: "1rem" }}>
			<PhotoPicker
				name="avatar"
				previous={row.avatar_path}
				label="📷 Change photo"
				maxSide={800}
				onUploaded={(avatar_path) => save({ avatar_path })}
			/>
			<div className="field-row" style={{ marginTop: "0.75rem" }}>
				<div className="field">
					<label htmlFor="edit-name">Name</label>
					<input
						id="edit-name"
						value={name}
						maxLength={40}
						required
						onChange={(e) => setName(e.target.value)}
					/>
				</div>
				<div className="field">
					<label htmlFor="edit-city">City</label>
					<input
						id="edit-city"
						value={city}
						maxLength={60}
						onChange={(e) => setCity(e.target.value)}
					/>
				</div>
			</div>
			<div className="field">
				<label htmlFor="instagram">Instagram</label>
				<input
					id="instagram"
					value={instagram}
					maxLength={40}
					onChange={(e) => setInstagram(e.target.value)}
				/>
			</div>
			<div className="field">
				<label htmlFor="bio">About you</label>
				<textarea
					id="bio"
					rows={4}
					maxLength={500}
					value={bio}
					onChange={(e) => setBio(e.target.value)}
				/>
			</div>
			<div className="field-row">
				<button
					className="btn-lime"
					disabled={busy || !name.trim()}
					onClick={() => {
						setBusy(true)
						setError(undefined)
						save({
							name: name.trim(),
							city: city.trim(),
							bio: bio.trim(),
							instagram: instagram.trim(),
						})
							.then(onDone)
							.catch((e: Error) => setError(e.message))
							.finally(() => setBusy(false))
					}}
				>
					{busy ? "Saving..." : "Save"}
				</button>
				<button className="btn-ghost" onClick={onDone}>
					Cancel
				</button>
			</div>
			<ErrorNotice error={error} />
		</div>
	)
}

/** Home photo and description, shown when you offer your home */
const HomeEditor = ({ row }: { row: ProfileRow }) => {
	const queryClient = useQueryClient()
	const photo = usePhotoUrl(row.home_photo_path)
	const [text, setText] = useState<string>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const save = async (patch: Partial<ProfileRow>) => {
		must(await supabase.from("profiles").update(patch).eq("id", row.id))
		await queryClient.invalidateQueries({ queryKey: ["profile"] })
		await queryClient.invalidateQueries({ queryKey: ["profiles"] })
	}

	return (
		<>
			{photo.data && (
				<div className="card-photo card-photo-home">
					<img src={photo.data} alt="My home" />
				</div>
			)}
			<div className="ts-card-body" style={{ paddingBottom: 0 }}>
				<PhotoPicker
					name="home"
					previous={row.home_photo_path}
					label={
						row.home_photo_path ? "📷 Change home photo" : "📷 Add a home photo"
					}
					onUploaded={(home_photo_path) => save({ home_photo_path })}
				/>
				<div className="field" style={{ marginTop: "0.75rem" }}>
					<label htmlFor="home-description">About your home</label>
					<textarea
						id="home-description"
						rows={4}
						maxLength={800}
						placeholder="Tell guests what they should know: pets, roommates, stairs, smoking, quiet hours, how far the studio is..."
						value={text ?? row.home_description}
						onChange={(e) => setText(e.target.value)}
					/>
				</div>
				{text !== undefined && text !== row.home_description && (
					<button
						className="btn-lime"
						disabled={busy}
						onClick={() => {
							setBusy(true)
							setError(undefined)
							save({ home_description: text.trim() })
								.then(() => setText(undefined))
								.catch((e: Error) => setError(e.message))
								.finally(() => setBusy(false))
						}}
					>
						{busy ? "Saving..." : "Save"}
					</button>
				)}
				<ErrorNotice error={error} />
			</div>
		</>
	)
}

/** Email, password and deleting the account */
const AccountSection = () => {
	const { session, signOut, deleteAccount, resetPassword } = useAuth()
	const [confirming, setConfirming] = useState(false)
	const [msg, setMsg] = useState<string>()
	const [error, setError] = useState<string>()
	const email = session?.user.email ?? ""

	return (
		<section className="ts-card" id="account">
			<div className="ts-card-body">
				<div className="meta">Signed in as {email}</div>
				<div className="field-row" style={{ marginTop: "0.75rem" }}>
					<button
						className="btn-ghost"
						onClick={() =>
							resetPassword(email)
								.then(() =>
									setMsg(`We sent a link to ${email} to change your password.`),
								)
								.catch((e: Error) => setError(e.message))
						}
					>
						Change password
					</button>
					<button className="btn-ghost" onClick={() => void signOut()}>
						Log out
					</button>
				</div>
				{msg && <div className="alert alert-ok">{msg}</div>}
				<div style={{ marginTop: "1rem" }}>
					{confirming ? (
						<div className="alert alert-error">
							This deletes your account, photos, trips, likes and chats for
							good. Reviews on Stellar stay, because nobody can delete them.
							<div className="field-row" style={{ marginTop: "0.6rem" }}>
								<button
									className="btn-danger"
									onClick={() =>
										deleteAccount().catch((e: Error) => setError(e.message))
									}
								>
									Yes, delete my account
								</button>
								<button
									className="btn-ghost"
									onClick={() => setConfirming(false)}
								>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<button
							className="link-btn danger"
							onClick={() => setConfirming(true)}
						>
							Delete my account
						</button>
					)}
				</div>
				<ErrorNotice error={error} />
			</div>
		</section>
	)
}

const Profile = () => {
	const { ready, session, loading, profile } = useAuth()
	const { address } = useWallet()
	const me = useArtist(address)
	const reviews = useReviews(address)
	const studios = useStudios()
	const queryClient = useQueryClient()
	const [editing, setEditing] = useState(false)
	const [wanted, setWanted] = useState(() => loadWishlist().wanted)
	const location = useLocation()
	// Links like /perfil#account jump to that section once it's rendered
	const section = location.hash.slice(1)
	const done = !!me.data
	useEffect(() => {
		if (done && section) scrollTo(section)
	}, [done, section])

	if (ready && !loading && !session) return <Navigate to="/entrar" replace />
	if (!address)
		return (
			<>
				<PageTitle title="My profile" />
				<div className="alert alert-info">
					{ready
						? "Getting your account ready..."
						: "Tap «Sign in» at the top."}
				</div>
			</>
		)
	if (me.isLoading) return <div className="empty-state">Loading...</div>
	if (!me.data || (ready && !profile))
		return (
			<>
				<PageTitle
					title="Welcome!"
					subtitle="Tell other artists who you are. Your reputation is stored on Stellar, where nobody can delete it."
				/>
				<RegisterForm registered={!!me.data} />
			</>
		)

	const a = me.data
	const myStudio = (studios.data ?? []).find((s) =>
		s.members.includes(a.address),
	)
	const unlocked = reputationOf(a).home_swap_unlocked
	const reviewsLeft = Math.max(1, HOME_SWAP_MIN_REVIEWS - a.review_count)

	const saveWanted = (next: string[]) => {
		setWanted(next)
		saveWishlist({ ...loadWishlist(), wanted: next })
		if (profile)
			void supabase
				.from("profiles")
				.update({ wanted: next })
				.eq("id", profile.id)
				.then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }))
	}

	return (
		<>
			{/* About you */}
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
								{a.city} · {profile?.instagram || a.instagram}
							</div>
							<div className="chips" style={{ marginTop: "0.3rem" }}>
								<TierBadge artist={a} />
								<RatingLine artist={a} />
							</div>
						</div>
					</div>
					{profile?.bio && !editing && (
						<p style={{ margin: "0.85rem 0 0" }}>{profile.bio}</p>
					)}
					{editing && profile ? (
						<EditAbout row={profile} onDone={() => setEditing(false)} />
					) : (
						<div className="field-row" style={{ marginTop: "1rem" }}>
							{profile && (
								<button className="btn-lime" onClick={() => setEditing(true)}>
									Edit profile
								</button>
							)}
							<Link to={`/artista/${a.address}`} className="btn-ghost">
								Preview
							</Link>
						</div>
					)}
				</div>
			</section>

			{/* Your studio */}
			<div className="split-title" id="mi-estudio">
				<h2>My studio</h2>
				{myStudio && (
					<Link to="/studio?dates" className="btn-lime">
						📅 Add availability
					</Link>
				)}
			</div>
			<PublishStudio me={a} />

			{/* What you need */}
			<div className="split-title" id="lo-que-busco">
				<h2>What I need</h2>
				<span className="hint">
					We'll match you with studios that meet your needs
				</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<AmenityPicker
						selected={wanted}
						onChange={saveWanted}
						copyFrom={myStudio?.amenities ?? []}
					/>
				</div>
			</section>

			{/* Your home */}
			<div className="split-title" id="mi-hogar">
				<h2>My home</h2>
			</div>
			<section className="ts-card">
				{unlocked ? (
					<>
						{profile && <HomeEditor row={profile} />}
						<div className="ts-card-body">
							<p style={{ marginTop: 0 }}>
								You can now offer your home, with your studio or on its own.
								Choose it when you add your studio's free dates.
							</p>
						</div>
					</>
				) : (
					<div className="ts-card-body">
						<p style={{ margin: 0, fontWeight: 700 }}>
							🔒 To access this feature, get {reviewsLeft} more{" "}
							{reviewsLeft === 1 ? "review" : "reviews"}!
						</p>
					</div>
				)}
			</section>

			{/* Access instructions */}
			<div className="split-title" id="acceso">
				<h2>Access instructions</h2>
				<span className="hint">
					🔒 Only guests with a confirmed stay see them
				</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<AccessEditor offersHome={unlocked} />
				</div>
			</section>

			{/* Reviews */}
			<div className="split-title">
				<h2>My reviews</h2>
				<Link to="/clientes" className="hint">
					Ask a client for a review with a QR →
				</Link>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<ReviewList reviews={reviews.data ?? []} />
				</div>
			</section>

			{ready && session && (
				<>
					<div className="split-title">
						<h2>Account</h2>
					</div>
					<AccountSection />
				</>
			)}
		</>
	)
}

export default Profile
