import { useQuery } from "@tanstack/react-query"
import { homePhoto, studioPhoto } from "../lib/photos"
import { must, type Profile, supabase } from "../lib/supabase"
import { useAuth } from "./useAuth"

// TATTOO APP: profiles and private photos from Supabase. Only signed-in
// people can read them; photos come as links that expire in an hour.

/** Every profile, by Stellar address (empty when signed out) */
export const useProfiles = () => {
	const { session } = useAuth()
	return useQuery({
		queryKey: ["profiles", session?.user.id],
		enabled: !!session,
		staleTime: 60_000,
		queryFn: async () => {
			const rows = must(
				await supabase
					.from("profiles")
					.select(
						"id, stellar_address, name, city, instagram, bio, avatar_path, home_description, home_photo_path",
					),
			) as Profile[]
			return new Map(
				rows
					.filter((p) => p.stellar_address)
					.map((p) => [p.stellar_address!, p]),
			)
		},
	})
}

export const useProfileOf = (address?: string) =>
	useProfiles().data?.get(address ?? "")

/** "photos" for profiles and studios; "access" for access instructions */
export type Bucket = "photos" | "access"

/** A temporary link to a private photo */
export const usePhotoUrl = (path?: string | null, bucket: Bucket = "photos") =>
	useQuery({
		queryKey: ["photo", bucket, path],
		enabled: !!path,
		staleTime: 50 * 60_000,
		queryFn: async () =>
			must(await supabase.storage.from(bucket).createSignedUrl(path!, 3600))
				.signedUrl,
	})

/** Shrinks a photo in the browser before uploading (max side, JPEG) */
const shrink = (file: File, maxSide: number) =>
	new Promise<Blob>((resolve, reject) => {
		const img = new Image()
		img.onload = () => {
			const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
			const canvas = document.createElement("canvas")
			canvas.width = Math.round(img.width * scale)
			canvas.height = Math.round(img.height * scale)
			canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Couldn't read the photo"))),
				"image/jpeg",
				0.85,
			)
			URL.revokeObjectURL(img.src)
		}
		img.onerror = () => reject(new Error("That file isn't a photo"))
		img.src = URL.createObjectURL(file)
	})

/** Uploads to my folder and returns its path; removes the previous one */
export async function uploadPhoto(
	userId: string,
	file: File,
	name: string,
	previous?: string | null,
	maxSide = 1600,
	bucket: Bucket = "photos",
) {
	const blob = await shrink(file, maxSide)
	const path = `${userId}/${name}-${Date.now()}.jpg`
	must(
		await supabase.storage
			.from(bucket)
			.upload(path, blob, { contentType: "image/jpeg" }),
	)
	if (previous) await supabase.storage.from(bucket).remove([previous])
	return path
}

/** Their own home photo, or the sample one from public/fotos */
export const useHomeImage = (artist: { address: string; name: string }) => {
	const own = usePhotoUrl(useProfileOf(artist.address)?.home_photo_path)
	return own.data ?? homePhoto(artist.name)
}

interface StudioPhotoRow {
	studio_id: number
	uploaded_by: string
	photo_path: string
	updated_at: string
}

/** Studio photos uploaded by one of its own artists, newest first */
export const useStudioPhotos = () => {
	const { session } = useAuth()
	return useQuery({
		queryKey: ["studio-photos", session?.user.id],
		enabled: !!session,
		staleTime: 60_000,
		queryFn: async () =>
			must(
				await supabase
					.from("studio_photos")
					.select("*")
					.order("updated_at", { ascending: false }),
			) as StudioPhotoRow[],
	})
}

/** The photo path of a studio, if one of its artists uploaded it */
export const useStudioPhotoPath = (studio?: {
	id: number
	members: string[]
}) => {
	const rows = useStudioPhotos().data ?? []
	const profiles = useProfiles().data
	if (!studio || !profiles) return undefined
	const memberIds = new Set(
		studio.members.map((m) => profiles.get(m)?.id).filter(Boolean),
	)
	return rows.find(
		(r) => r.studio_id === studio.id && memberIds.has(r.uploaded_by),
	)?.photo_path
}

/** A studio's own photo, or the sample one from public/fotos */
export const useStudioImage = (studio?: {
	id: number
	name: string
	members: string[]
}) => {
	const own = usePhotoUrl(useStudioPhotoPath(studio))
	return own.data ?? studioPhoto(studio?.name ?? "")
}
