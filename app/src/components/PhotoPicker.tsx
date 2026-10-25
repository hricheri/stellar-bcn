import { useRef, useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { uploadPhoto } from "../hooks/useProfiles"
import { ErrorNotice } from "./TattooUI"

/** A button that uploads a private photo to my folder and returns its path */
export const PhotoPicker = ({
	name,
	previous,
	label,
	maxSide,
	onUploaded,
}: {
	/** File name prefix, e.g. "avatar" or "studio-3" */
	name: string
	previous?: string | null
	label: string
	maxSide?: number
	onUploaded: (path: string) => Promise<void> | void
}) => {
	const { userId } = useAuth()
	const input = useRef<HTMLInputElement>(null)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	if (!userId) return null

	const pick = async (file?: File) => {
		if (!file) return
		setBusy(true)
		setError(undefined)
		try {
			await onUploaded(await uploadPhoto(userId, file, name, previous, maxSide))
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
			if (input.current) input.current.value = ""
		}
	}

	return (
		<>
			<input
				ref={input}
				type="file"
				accept="image/*"
				hidden
				onChange={(e) => void pick(e.target.files?.[0])}
			/>
			<button
				type="button"
				className="btn-ghost"
				disabled={busy}
				onClick={() => input.current?.click()}
			>
				{busy ? "Uploading..." : label}
			</button>
			<ErrorNotice error={error} />
		</>
	)
}
