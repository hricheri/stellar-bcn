import { useState } from "react"
import {
	useAccessInfoOf,
	useMyAccessInfo,
	useSaveAccessInfo,
} from "../hooks/useAccess"
import { useAuth } from "../hooks/useAuth"
import { usePhotoUrl } from "../hooks/useProfiles"
import { useStudioAddressForGuest } from "../hooks/useStudioPlace"
import { supabase } from "../lib/supabase"
import { AreaMap } from "./AreaMap"
import { PhotoPicker } from "./PhotoPicker"
import { ErrorNotice } from "./TattooUI"

// TATTOO APP: access instructions. The host writes them once in the
// profile; each confirmed guest sees them in Guest, under View details.

const MAX_PHOTOS = 6

const AccessPhoto = ({
	path,
	onRemove,
}: {
	path: string
	onRemove?: () => void
}) => {
	const url = usePhotoUrl(path, "access")
	return (
		<div className="access-photo">
			{url.data ? (
				<a href={url.data} target="_blank" rel="noreferrer">
					<img src={url.data} alt="How to get in" />
				</a>
			) : (
				<div className="cover-fallback" />
			)}
			{onRemove && (
				<button
					type="button"
					className="access-photo-remove"
					aria-label="Remove photo"
					onClick={onRemove}
				>
					✕
				</button>
			)}
		</div>
	)
}

/** In my profile: write the instructions and add photos */
export const AccessEditor = ({ offersHome }: { offersHome: boolean }) => {
	const { userId } = useAuth()
	const info = useMyAccessInfo()
	const save = useSaveAccessInfo()
	const [studio, setStudio] = useState<string>()
	const [home, setHome] = useState<string>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [saved, setSaved] = useState(false)
	if (info.isLoading) return null

	const photos = info.data?.photo_paths ?? []
	const studioText = studio ?? info.data?.studio_text ?? ""
	const homeText = home ?? info.data?.home_text ?? ""

	const run = (fn: () => Promise<void>) => {
		setBusy(true)
		setError(undefined)
		setSaved(false)
		fn()
			.catch((e: Error) => setError(e.message))
			.finally(() => setBusy(false))
	}

	return (
		<div>
			<div className="field">
				<label htmlFor="access-studio">How to get into the studio</label>
				<textarea
					id="access-studio"
					rows={4}
					maxLength={2000}
					placeholder="Door code, which bell to ring, floor, where the keys are, wifi..."
					value={studioText}
					onChange={(e) => setStudio(e.target.value)}
				/>
			</div>
			{offersHome && (
				<div className="field">
					<label htmlFor="access-home">How to get into your home</label>
					<textarea
						id="access-home"
						rows={4}
						maxLength={2000}
						placeholder="Keys, door code, house rules..."
						value={homeText}
						onChange={(e) => setHome(e.target.value)}
					/>
				</div>
			)}

			<div className="section-label">Photos (the door, the bell...)</div>
			<div className="access-photos">
				{photos.map((p) => (
					<AccessPhoto
						key={p}
						path={p}
						onRemove={() =>
							run(async () => {
								await save({ photo_paths: photos.filter((x) => x !== p) })
								await supabase.storage.from("access").remove([p])
							})
						}
					/>
				))}
			</div>
			{userId && photos.length < MAX_PHOTOS && (
				<PhotoPicker
					name="access"
					bucket="access"
					label="📷 Add a photo"
					onUploaded={(path) => save({ photo_paths: [...photos, path] })}
				/>
			)}

			<button
				className="btn-lime btn-block"
				style={{ marginTop: "1rem" }}
				disabled={busy || (studio === undefined && home === undefined)}
				onClick={() =>
					run(async () => {
						await save({
							studio_text: studioText.trim(),
							home_text: homeText.trim(),
						})
						setSaved(true)
					})
				}
			>
				{busy ? "Saving..." : "Save instructions"}
			</button>
			{saved && (
				<div className="alert alert-ok">
					Saved. Guests see them once their stay is confirmed.
				</div>
			)}
			<ErrorNotice error={error} />
		</div>
	)
}

/** For a confirmed guest: the address and the host's instructions */
export const AccessView = ({
	host,
	studioId,
	home,
}: {
	host: string
	studioId: number
	home: boolean
}) => {
	const info = useAccessInfoOf(host)
	const address = useStudioAddressForGuest(studioId)
	if (info.isLoading) return <div className="hint">Loading...</div>
	const i = info.data
	const where = address.data && (
		<>
			<div className="section-label">Address</div>
			<p className="pre">📍 {address.data.address}</p>
			<AreaMap
				lat={address.data.lat}
				lng={address.data.lng}
				exact
				label={`Map of ${address.data.address}`}
			/>
		</>
	)
	if (!i || (!i.studio_text && !i.home_text && i.photo_paths.length === 0))
		return (
			<>
				{where}
				<p className="hint">
					The host's access instructions will show up here once they open the
					app. You can also ask in the chat.
				</p>
			</>
		)
	return (
		<div className="access-view">
			{where}
			{i.studio_text && (
				<>
					<div className="section-label">How to get into the studio</div>
					<p className="pre">{i.studio_text}</p>
				</>
			)}
			{home && i.home_text && (
				<>
					<div className="section-label">How to get into the home</div>
					<p className="pre">{i.home_text}</p>
				</>
			)}
			{i.photo_paths.length > 0 && (
				<div className="access-photos">
					{i.photo_paths.map((p) => (
						<AccessPhoto key={p} path={p} />
					))}
				</div>
			)}
		</div>
	)
}
