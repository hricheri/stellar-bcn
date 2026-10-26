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

// TATTOO APP: access instructions. The host writes them in the profile, the
// studio ones under My studio and the home ones under My home; each
// confirmed guest sees them in Guest, under View details.

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

/** Studio photos are named "access-studio-...", home ones "access-home-..." */
type Part = "studio" | "home"
const partOf = (path: string): Part =>
	path.split("/").pop()!.startsWith("access-home-") ? "home" : "studio"

/** In my profile: how to get into my studio, or into my home, with photos */
export const AccessEditor = ({ part }: { part: Part }) => {
	const { userId } = useAuth()
	const info = useMyAccessInfo()
	const save = useSaveAccessInfo()
	const [text, setText] = useState<string>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [saved, setSaved] = useState(false)
	if (info.isLoading) return null

	const field = part === "studio" ? "studio_text" : "home_text"
	const all = info.data?.photo_paths ?? []
	const photos = all.filter((p) => partOf(p) === part)
	const value = text ?? info.data?.[field] ?? ""

	const run = (fn: () => Promise<void>) => {
		setBusy(true)
		setError(undefined)
		setSaved(false)
		fn()
			.catch((e: Error) => setError(e.message))
			.finally(() => setBusy(false))
	}

	return (
		<div className="access-editor">
			<div className="section-label">
				🔒 How to get in · only guests with a confirmed stay see it
			</div>
			<div className="field">
				<textarea
					aria-label={`How to get into your ${part}`}
					rows={4}
					maxLength={2000}
					placeholder={
						part === "studio"
							? "Door code, which bell to ring, floor, where the keys are, wifi..."
							: "Keys, door code, house rules..."
					}
					value={value}
					onChange={(e) => setText(e.target.value)}
				/>
			</div>

			<div className="access-photos">
				{photos.map((p) => (
					<AccessPhoto
						key={p}
						path={p}
						onRemove={() =>
							run(async () => {
								await save({ photo_paths: all.filter((x) => x !== p) })
								await supabase.storage.from("access").remove([p])
							})
						}
					/>
				))}
			</div>
			<div className="field-row">
				{userId && photos.length < MAX_PHOTOS && (
					<PhotoPicker
						name={`access-${part}`}
						bucket="access"
						label="📷 Photo of the door, the bell..."
						onUploaded={(path) => save({ photo_paths: [...all, path] })}
					/>
				)}
				<button
					className="btn-lime"
					disabled={busy || text === undefined}
					onClick={() =>
						run(async () => {
							await save({ [field]: value.trim() })
							setText(undefined)
							setSaved(true)
						})
					}
				>
					{busy ? "Saving..." : "Save instructions"}
				</button>
			</div>
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
			{(["studio", "home"] as const).map((part) => {
				const text = part === "studio" ? i.studio_text : i.home_text
				const photos = i.photo_paths.filter((p) => partOf(p) === part)
				if ((part === "home" && !home) || (!text && photos.length === 0))
					return null
				return (
					<div key={part}>
						<div className="section-label">How to get into the {part}</div>
						{text && <p className="pre">{text}</p>}
						{photos.length > 0 && (
							<div className="access-photos">
								{photos.map((p) => (
									<AccessPhoto key={p} path={p} />
								))}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}
