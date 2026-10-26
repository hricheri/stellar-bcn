import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import { type AccessInfo, maybe, must, supabase } from "../lib/supabase"
import { BK_CONFIRMED } from "../lib/tattoo"
import { useAuth } from "./useAuth"
import { useProfileOf, useProfiles } from "./useProfiles"
import { useBookings, useStudios } from "./useTattoo"
import { useWallet } from "./useWallet"

// TATTOO APP: access instructions (how to get in, door photos). Only their
// owner and guests with a confirmed stay can read them.

const toDate = (unix: number) =>
	new Date(unix * 1000).toISOString().slice(0, 10)

/** My own instructions, to edit them */
export const useMyAccessInfo = () => {
	const { userId } = useAuth()
	return useQuery({
		queryKey: ["access-info", userId],
		enabled: !!userId,
		queryFn: async () =>
			maybe(
				await supabase
					.from("access_info")
					.select("*")
					.eq("owner", userId!)
					.maybeSingle(),
			) as AccessInfo | null,
	})
}

export const useSaveAccessInfo = () => {
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	return useCallback(
		async (patch: Partial<Omit<AccessInfo, "owner">>) => {
			if (!userId) throw new Error("Sign in first.")
			must(
				await supabase
					.from("access_info")
					.upsert({ owner: userId, ...patch })
					.select("owner"),
			)
			await queryClient.invalidateQueries({ queryKey: ["access-info"] })
		},
		[userId, queryClient],
	)
}

/** A host's instructions; null until they gave me access */
export const useAccessInfoOf = (host?: string) => {
	const them = useProfileOf(host)
	return useQuery({
		queryKey: ["access-info", them?.id],
		enabled: !!them,
		refetchInterval: 60_000,
		queryFn: async () =>
			maybe(
				await supabase
					.from("access_info")
					.select("*")
					.eq("owner", them!.id)
					.maybeSingle(),
			) as AccessInfo | null,
	})
}

/**
 * Hosts: gives each confirmed guest access to my instructions until their
 * stay ends. Stays are confirmed on Stellar, so the host's app does it.
 */
export const useAccessGrantSync = () => {
	const { address } = useWallet()
	const { userId } = useAuth()
	const bookings = useBookings(address)
	const studios = useStudios()
	const profiles = useProfiles()
	const done = useRef(new Set<string>())

	useEffect(() => {
		if (!userId || !address || !bookings.data || !profiles.data) return
		const myStudios = new Set(
			(studios.data ?? [])
				.filter((s) => s.members.includes(address))
				.map((s) => s.id),
		)
		const now = Date.now() / 1000
		const rows = bookings.data
			.filter(
				(b) =>
					b.status === BK_CONFIRMED &&
					Number(b.end) >= now - 86_400 &&
					b.guest !== address &&
					(b.host === address || myStudios.has(b.studio_id)),
			)
			.map((b) => ({
				owner: userId,
				guest: profiles.data.get(b.guest)?.id,
				until: toDate(Number(b.end)),
			}))
			.filter(
				(r): r is { owner: string; guest: string; until: string } =>
					!!r.guest && !done.current.has(`${r.guest}/${r.until}`),
			)
		if (rows.length === 0) return
		for (const r of rows) done.current.add(`${r.guest}/${r.until}`)
		void supabase.from("access_grants").upsert(rows)
	}, [userId, address, bookings.data, studios.data, profiles.data])
}

/** Runs the sync while the app is open */
export const AccessGrantSync = () => {
	useAccessGrantSync()
	return null
}
