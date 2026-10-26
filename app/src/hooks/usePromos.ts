import { useQuery, useQueryClient } from "@tanstack/react-query"
import { must, type PromoGraphic, supabase } from "../lib/supabase"
import { useAuth } from "./useAuth"

// TATTOO APP: the guest artist graphics of a stay. Mine and the other
// artist's, both saved in the private "promos" bucket.

export const MAX_PROMOS = 5

export const usePromoGraphics = (bookingId: number) => {
	const { session } = useAuth()
	return useQuery({
		queryKey: ["promos", bookingId],
		enabled: !!session,
		queryFn: async () =>
			must(
				await supabase
					.from("promo_graphics")
					.select("*")
					.eq("booking_id", bookingId)
					.order("created_at"),
			) as PromoGraphic[],
	})
}

export const usePromoActions = (bookingId: number) => {
	const queryClient = useQueryClient()
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: ["promos", bookingId] })
	return {
		add: async (row: { path: string; shared_with: string; city: string }) => {
			const res = await supabase
				.from("promo_graphics")
				.insert({ booking_id: bookingId, ...row })
			if (res.error) {
				await supabase.storage.from("promos").remove([row.path])
				throw new Error(
					res.error.code === "42501"
						? `You can upload up to ${MAX_PROMOS} graphics per stay.`
						: res.error.message,
				)
			}
			await refresh()
		},
		remove: async (g: PromoGraphic) => {
			must(await supabase.from("promo_graphics").delete().eq("id", g.id))
			await supabase.storage.from("promos").remove([g.path])
			await refresh()
		},
	}
}

/** Opens a download of the full graphic */
export const downloadPromo = async (path: string) => {
	const { signedUrl } = must(
		await supabase.storage
			.from("promos")
			.createSignedUrl(path, 600, { download: true }),
	)
	window.location.assign(signedUrl)
}
