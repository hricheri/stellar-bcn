import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { maybe, must, supabase } from "../lib/supabase"
import { useAuth } from "./useAuth"
import { useProfiles } from "./useProfiles"

// TATTOO APP: where a studio is. Everyone signed in sees the general area
// (~1 km); the exact address stays with the artist who wrote it.

export interface Place {
	lat: number
	lng: number
	/** Neighbourhood and city, e.g. "Gràcia, Barcelona" */
	area: string
}

interface PlaceRow extends Place {
	studio_id: number
	set_by: string
}

/** Looks up an address on OpenStreetMap */
export const geocode = async (
	q: string,
): Promise<Place & { label: string }> => {
	const res = await fetch(
		`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(q)}`,
		{ headers: { "Accept-Language": "en" } },
	)
	if (!res.ok) throw new Error("We couldn't look up the address. Try again.")
	const [hit] = (await res.json()) as {
		lat: string
		lon: string
		display_name: string
		address?: Record<string, string>
	}[]
	if (!hit)
		throw new Error("We couldn't find that address. Check it and try again.")
	const a = hit.address ?? {}
	const city = a.city ?? a.town ?? a.village ?? a.municipality ?? ""
	const hood = a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? ""
	return {
		lat: Number(hit.lat),
		lng: Number(hit.lon),
		area: [hood, city].filter(Boolean).join(", "),
		label: hit.display_name,
	}
}

const useAllPlaces = () => {
	const { session } = useAuth()
	return useQuery({
		queryKey: ["studio-places", session?.user.id],
		enabled: !!session,
		staleTime: 60_000,
		queryFn: async () =>
			must(await supabase.from("studio_places").select("*")) as PlaceRow[],
	})
}

/** A studio's general area: set by one of its artists, or its city's center */
export const useStudioArea = (studio?: {
	id: number
	city: string
	members: string[]
}) => {
	const rows = useAllPlaces().data
	const profiles = useProfiles().data
	const memberIds = new Set(
		(studio?.members ?? []).map((m) => profiles?.get(m)?.id).filter(Boolean),
	)
	const own = rows?.find(
		(r) => r.studio_id === studio?.id && memberIds.has(r.set_by),
	)
	const city = useQuery({
		queryKey: ["geocode-city", studio?.city],
		enabled: !!studio?.city && !!rows && !own,
		staleTime: Infinity,
		queryFn: () => geocode(studio!.city),
	})
	if (own) return { ...own, exact: true }
	return city.data
		? { ...city.data, area: studio!.city, exact: false }
		: undefined
}

/** The exact address I saved for a studio */
export const useMyStudioAddress = (studioId?: number) => {
	const { userId } = useAuth()
	return useQuery({
		queryKey: ["studio-address", studioId, userId],
		enabled: studioId !== undefined && !!userId,
		queryFn: async () =>
			maybe(
				await supabase
					.from("studio_addresses")
					.select("address, lat, lng")
					.eq("studio_id", studioId!)
					.eq("set_by", userId!)
					.maybeSingle(),
			) as { address: string; lat: number; lng: number } | null,
	})
}

/** Saves the exact address (private) and its general area (for everyone) */
export const useSaveStudioAddress = () => {
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	return useCallback(
		async (studioId: number, address: string, place: Place) => {
			if (!userId) throw new Error("Sign in first.")
			must(
				await supabase.from("studio_addresses").upsert({
					studio_id: studioId,
					set_by: userId,
					address,
					lat: place.lat,
					lng: place.lng,
					updated_at: new Date().toISOString(),
				}),
			)
			must(
				await supabase.from("studio_places").upsert({
					studio_id: studioId,
					set_by: userId,
					area: place.area,
					lat: place.lat,
					lng: place.lng,
				}),
			)
			await queryClient.invalidateQueries({ queryKey: ["studio-places"] })
			await queryClient.invalidateQueries({ queryKey: ["studio-address"] })
		},
		[userId, queryClient],
	)
}
