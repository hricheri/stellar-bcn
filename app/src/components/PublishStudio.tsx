import { useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useAuth } from "../hooks/useAuth"
import {
	usePhotoUrl,
	useStudioImage,
	useStudioPhotoPath,
} from "../hooks/useProfiles"
import { useSaveStudioAddress } from "../hooks/useStudioPlace"
import { useArtists, useSend, useStudios } from "../hooks/useTattoo"
import { must, supabase } from "../lib/supabase"
import {
	amenityLabel,
	type Artist,
	DEFAULT_WANTED,
	type Studio,
	studioAvg,
	studioTier,
} from "../lib/tattoo"
import { AmenityPicker } from "./AmenityPicker"
import { PhotoPicker } from "./PhotoPicker"
import {
	AddressInput,
	type CheckedAddress,
	StudioAddress,
} from "./StudioAddress"
import { ErrorNotice, Photo, StudioTierBadge, TxNotice } from "./TattooUI"

/** Runs a contract call and keeps its busy / error / tx state */
const useAction = () => {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const run = async (fn: () => Promise<{ hash?: string }>) => {
		setBusy(true)
		setError(undefined)
		setHash(undefined)
		try {
			setHash((await fn()).hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}
	return { busy, error, hash, run }
}

/** One studio I work at: its own reputation, its artists and its supplies */
const StudioPanel = ({
	studio,
	me,
	artists,
}: {
	studio: Studio
	me: Artist
	artists: Map<string, Artist>
}) => {
	const send = useSend()
	const action = useAction()
	const [editing, setEditing] = useState(false)
	const [amenities, setAmenities] = useState<string[]>(studio.amenities)
	const [newArtist, setNewArtist] = useState("")
	const others = [...artists.values()].filter(
		(a) => !studio.members.includes(a.address),
	)
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	const image = useStudioImage(studio)
	const photoPath = useStudioPhotoPath(studio)

	const savePhoto = async (path: string) => {
		must(
			await supabase.from("studio_photos").upsert({
				studio_id: studio.id,
				uploaded_by: userId!,
				photo_path: path,
				updated_at: new Date().toISOString(),
			}),
		)
		await queryClient.invalidateQueries({ queryKey: ["studio-photos"] })
	}

	return (
		<section className="ts-card">
			<div className="card-photo card-photo-studio">
				<Photo
					key={image}
					src={image}
					alt={studio.name}
					fallback={<div className="cover-fallback" />}
				/>
				<span className="card-city">{studio.city}</span>
			</div>
			<div className="ts-card-body">
				{userId && (
					<div style={{ marginBottom: "0.75rem" }}>
						<PhotoPicker
							name={`studio-${studio.id}`}
							previous={photoPath}
							label="📷 Change studio photo"
							onUploaded={savePhoto}
						/>
					</div>
				)}
				<div className="split-title" style={{ margin: 0 }}>
					<h2>🏠 {studio.name}</h2>
					<StudioTierBadge tier={studioTier(studio, artists)} />
				</div>
				<div className="meta">
					{studio.city} · ⭐ {studioAvg(studio)} ({studio.review_count}{" "}
					{studio.review_count === 1 ? "review" : "reviews"} of the studio)
				</div>
				<div className="hint" style={{ marginTop: "0.35rem" }}>
					The studio has its own reputation, built from guests' reviews,
					separate from each artist's.
				</div>

				<div className="section-label">Where it is</div>
				<StudioAddress studioId={studio.id} city={studio.city} />

				<div className="section-label">Studio artists</div>
				<div className="chips">
					{studio.members.map((m) => (
						<span key={m} className="chip chip-has">
							{artists.get(m)?.name ?? m.slice(0, 6)}
						</span>
					))}
				</div>
				<div className="field-row" style={{ marginTop: "0.5rem" }}>
					<div className="field">
						<select
							aria-label="Add an artist"
							value={newArtist}
							onChange={(e) => setNewArtist(e.target.value)}
						>
							<option value="">Add another artist...</option>
							{others.map((a) => (
								<option key={a.address} value={a.address}>
									{a.name} ({a.city})
								</option>
							))}
						</select>
					</div>
					<button
						className="btn-ghost"
						disabled={!newArtist || action.busy}
						onClick={() =>
							void action.run(() =>
								send((c, member, o) =>
									c.add_studio_artist(
										{ member, studio_id: studio.id, artist: newArtist },
										o,
									),
								),
							)
						}
					>
						Add
					</button>
				</div>

				<div className="section-label">Furniture and supplies</div>
				{editing ? (
					<>
						<AmenityPicker selected={amenities} onChange={setAmenities} />
						<button
							className="btn-lavender"
							style={{ marginTop: "0.5rem" }}
							disabled={action.busy}
							onClick={() =>
								void action
									.run(() =>
										send((c, member, o) =>
											c.update_studio_amenities(
												{ member, studio_id: studio.id, amenities },
												o,
											),
										),
									)
									.then(() => setEditing(false))
							}
						>
							Save supplies
						</button>
					</>
				) : (
					<>
						<div className="chips">
							{studio.amenities.map((a) => (
								<span key={a} className="chip chip-has">
									{amenityLabel(a)}
								</span>
							))}
						</div>
						<button
							className="btn-ghost"
							style={{ marginTop: "0.5rem" }}
							onClick={() => setEditing(true)}
						>
							Edit supplies
						</button>
					</>
				)}
				<ErrorNotice error={action.error} />
				{action.hash && <TxNotice hash={action.hash} text="Studio updated." />}
				{me.address !== studio.members[0] && (
					<div className="hint" style={{ marginTop: "0.5rem" }}>
						Added by {artists.get(studio.members[0]!)?.name ?? "another artist"}
						.
					</div>
				)}
			</div>
		</section>
	)
}

/** Saves a studio photo row, so the studio's artists show it */
const useSaveStudioPhoto = () => {
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	return async (studioId: number, path: string) => {
		must(
			await supabase.from("studio_photos").upsert({
				studio_id: studioId,
				uploaded_by: userId!,
				photo_path: path,
				updated_at: new Date().toISOString(),
			}),
		)
		await queryClient.invalidateQueries({ queryKey: ["studio-photos"] })
	}
}

const CreateStudio = ({ me }: { me: Artist }) => {
	const send = useSend()
	const savePhoto = useSaveStudioPhoto()
	const saveAddress = useSaveStudioAddress()
	const [amenities, setAmenities] = useState<string[]>(DEFAULT_WANTED)
	const [city, setCity] = useState(me.city)
	const [photo, setPhoto] = useState<string>()
	const preview = usePhotoUrl(photo)
	const [address, setAddress] = useState<CheckedAddress>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	const create = async (name: string) => {
		setBusy(true)
		setError(undefined)
		try {
			const { value: id, hash } = await send((c, owner, o) =>
				c.create_studio({ owner, name, city: city.trim(), amenities }, o),
			)
			const studioId = Number(id)
			if (photo) await savePhoto(studioId, photo)
			if (address) await saveAddress(studioId, address.address, address.place)
			setHash(hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="ts-card">
			{preview.data && (
				<div className="card-photo card-photo-studio">
					<img src={preview.data} alt="Your studio" />
				</div>
			)}
			<form
				className="ts-card-body"
				action={(form) => create(String(form.get("name")).trim())}
			>
				<h2 style={{ marginBottom: "0.85rem" }}>Create my studio</h2>
				<PhotoPicker
					name="studio-new"
					previous={photo}
					label={photo ? "📷 Change the photo" : "📷 Add a studio photo"}
					onUploaded={setPhoto}
				/>
				<div className="field-row" style={{ marginTop: "0.75rem" }}>
					<div className="field">
						<label htmlFor="name">Studio name</label>
						<input id="name" name="name" required />
					</div>
					<div className="field">
						<label htmlFor="city">City</label>
						<input
							id="city"
							required
							value={city}
							onChange={(e) => setCity(e.target.value)}
						/>
					</div>
				</div>
				<AddressInput city={city} onChecked={setAddress} />
				<div className="section-label">What does your studio offer?</div>
				<AmenityPicker selected={amenities} onChange={setAmenities} />
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={busy || !photo || !address}
				>
					{busy
						? "Creating..."
						: !photo
							? "Add a photo to continue"
							: !address
								? "Check the address on the map to continue"
								: "Create studio"}
				</button>
				<ErrorNotice error={error} />
				{hash && (
					<TxNotice
						hash={hash}
						text="Studio created! Now add its availability in the Calendar."
					/>
				)}
			</form>
		</section>
	)
}

/** "My studio" inside the profile */
export const PublishStudio = ({ me }: { me: Artist }) => {
	const studios = useStudios()
	const artists = useArtists()
	const [creating, setCreating] = useState(false)
	const byAddress = useMemo(
		() => new Map((artists.data ?? []).map((a) => [a.address, a])),
		[artists.data],
	)
	const mine = (studios.data ?? []).filter((s) =>
		s.members.includes(me.address),
	)

	return (
		<>
			{mine.map((s) => (
				<StudioPanel key={s.id} studio={s} me={me} artists={byAddress} />
			))}
			{mine.length === 0 && (
				<p className="section-sub">
					Want to share your studio with the community? Create it here and set
					its availability!
				</p>
			)}
			{creating || mine.length === 0 ? (
				<CreateStudio me={me} />
			) : (
				<button className="btn-ghost" onClick={() => setCreating(true)}>
					+ Create another studio
				</button>
			)}
		</>
	)
}
