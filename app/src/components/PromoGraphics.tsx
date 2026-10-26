import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { usePhotoUrl, useProfileOf } from "../hooks/useProfiles"
import {
	downloadPromo,
	MAX_PROMOS,
	usePromoActions,
	usePromoGraphics,
} from "../hooks/usePromos"
import { useSend } from "../hooks/useTattoo"
import { supabase } from "../lib/supabase"
import {
	type Artist,
	type Booking,
	formatDate,
	promoDeadline,
} from "../lib/tattoo"
import { PhotoPicker } from "./PhotoPicker"
import { ErrorNotice } from "./TattooUI"

// TATTOO APP: "Guest spot in Barcelona, 10-30 Nov". Each artist uploads up
// to 5 graphics for the stay; the other one can see and download them once
// they're sent. Sending the first one marks the graphic as posted on Stellar.

const Graphic = ({
	path,
	onRemove,
}: {
	path: string
	onRemove?: () => void
}) => {
	const url = usePhotoUrl(path, "promos")
	return (
		<div className="access-photo">
			{url.data ? (
				<img src={url.data} alt="Guest artist graphic" />
			) : (
				<div className="cover-fallback" />
			)}
			<button
				type="button"
				className="promo-download"
				aria-label="Download"
				title="Download"
				onClick={() => void downloadPromo(path)}
			>
				⬇
			</button>
			{onRemove && (
				<button
					type="button"
					className="access-photo-remove"
					aria-label="Remove graphic"
					onClick={onRemove}
				>
					✕
				</button>
			)}
		</div>
	)
}

export const PromoGraphics = ({
	booking: b,
	me,
	other,
	city,
}: {
	booking: Booking
	me: string
	other?: Artist
	city: string
}) => {
	const { userId } = useAuth()
	const otherProfile = useProfileOf(other?.address)
	const graphics = usePromoGraphics(b.id)
	const { add, remove } = usePromoActions(b.id)
	const send = useSend()
	const [error, setError] = useState<string>()

	const amHost = b.host === me
	const posted = amHost ? b.host_promo_sent : b.guest_promo_sent
	const mine = (graphics.data ?? []).filter((g) => g.owner === userId)
	const theirs = (graphics.data ?? []).filter((g) => g.owner !== userId)

	// Uploaded but not sent yet: only I can see them
	const [ready, setReady] = useState<string[]>([])
	const [sending, setSending] = useState(false)

	const sendAll = async () => {
		setError(undefined)
		setSending(true)
		try {
			if (!otherProfile) throw new Error("The other artist has no account yet.")
			for (const path of ready) {
				await add({ path, shared_with: otherProfile.id, city })
				setReady((r) => r.filter((p) => p !== path))
			}
			if (!posted)
				await send((c, artist, o) =>
					c.mark_promo_sent({ artist, booking_id: b.id }, o),
				)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setSending(false)
		}
	}

	const discard = (path: string) => {
		setReady((r) => r.filter((p) => p !== path))
		void supabase.storage.from("promos").remove([path])
	}

	const count = mine.length + ready.length

	return (
		<div className="promo-graphics">
			<div className="section-label">📣 My guest artist graphics</div>
			{!posted && (
				<p className="hint" style={{ marginTop: 0 }}>
					Send it before {formatDate(promoDeadline(b.start))}, so clients know
					the dates. {other?.name ?? "The other artist"} can download it.
				</p>
			)}
			{count > 0 && (
				<div className="access-photos">
					{mine.map((g) => (
						<Graphic
							key={g.id}
							path={g.path}
							onRemove={() =>
								void remove(g).catch((e: Error) => setError(e.message))
							}
						/>
					))}
					{ready.map((path) => (
						<Graphic key={path} path={path} onRemove={() => discard(path)} />
					))}
				</div>
			)}
			<div className="card-actions">
				{count < MAX_PROMOS && otherProfile && (
					<PhotoPicker
						name={`promo-${b.id}`}
						bucket="promos"
						maxSide={2048}
						label={`📷 Add a graphic (${count}/${MAX_PROMOS})`}
						onUploaded={(path) => setReady((r) => [...r, path])}
					/>
				)}
				{ready.length > 0 && (
					<button
						className="btn-lavender"
						disabled={sending}
						onClick={() => void sendAll()}
					>
						{sending
							? "Sending..."
							: `➤ Send ${ready.length === 1 ? "it" : `${ready.length} graphics`} to ${other?.name ?? "the other artist"}`}
					</button>
				)}
			</div>
			<ErrorNotice error={error} />

			{theirs.length > 0 && (
				<>
					<div className="section-label">
						{other?.name ?? "Their"}'s graphics
					</div>
					<div className="access-photos">
						{theirs.map((g) => (
							<Graphic key={g.id} path={g.path} />
						))}
					</div>
				</>
			)}
		</div>
	)
}
