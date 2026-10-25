import { tattooGuestSpot } from "@stellar-scaffold/app-lib/clients"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { must, supabase } from "../lib/supabase"
import { useAuth } from "./useAuth"
import { useProfiles } from "./useProfiles"
import { useSend } from "./useTattoo"
import { useWallet } from "./useWallet"

// TATTOO APP: favorites (likes). With an account they're private, in
// Supabase: only you and the person you liked can see a like. Without
// Supabase set up, the old public likes on Stellar are used.

/** The Stellar addresses I liked */
export const useLikes = () => {
	const { address } = useWallet()
	const { ready, userId } = useAuth()
	return useQuery({
		queryKey: ["likes", ready ? userId : address],
		enabled: ready ? !!userId : !!address,
		queryFn: async () =>
			ready
				? (
						must(
							await supabase.from("likes").select("liked").eq("liker", userId!),
						) as { liked: string }[]
					).map((l) => l.liked)
				: (await tattooGuestSpot.list_likes({ artist: address! })).result,
	})
}

/** The Stellar addresses of those who liked me */
export const useLikedMe = (everyone: string[]) => {
	const { address } = useWallet()
	const { ready, userId } = useAuth()
	const profiles = useProfiles()
	return useQuery({
		queryKey: ["liked-me", ready ? userId : address, everyone.length],
		enabled: ready ? !!userId && !!address && !!profiles.data : !!address,
		queryFn: async (): Promise<Set<string>> => {
			if (!ready) {
				const all = await Promise.all(
					everyone.map(async (a) =>
						(await tattooGuestSpot.list_likes({ artist: a })).result.includes(
							address!,
						)
							? a
							: undefined,
					),
				)
				return new Set(all.filter((a): a is string => !!a))
			}
			const rows = must(
				await supabase.from("likes").select("liker").eq("liked", address!),
			) as { liker: string }[]
			const byId = new Map(
				[...profiles.data!.values()].map((p) => [p.id, p.stellar_address]),
			)
			return new Set(
				rows.map((r) => byId.get(r.liker)).filter((a): a is string => !!a),
			)
		},
	})
}

/** Returns like(address), which resolves true when it's a match */
export const useLike = () => {
	const { address } = useWallet()
	const { ready, userId } = useAuth()
	const profiles = useProfiles()
	const send = useSend()
	const queryClient = useQueryClient()

	return useCallback(
		async (artist: string) => {
			if (!ready) {
				const { value } = await send((c, from, o) =>
					c.like_artist({ from, to: artist }, o),
				)
				return Boolean(value)
			}
			if (!userId) throw new Error("Sign in first.")
			const { error } = await supabase
				.from("likes")
				.insert({ liker: userId, liked: artist })
			// 23505: already liked
			if (error && error.code !== "23505")
				throw new Error(
					error.code === "23503" ? "First create your profile." : error.message,
				)
			await queryClient.invalidateQueries({ queryKey: ["likes"] })
			// A match: they had liked me before
			const them = profiles.data?.get(artist)
			if (!them || !address) return false
			const back = must(
				await supabase
					.from("likes")
					.select("liker")
					.eq("liker", them.id)
					.eq("liked", address),
			) as unknown[]
			return back.length > 0
		},
		[ready, userId, address, profiles.data, send, queryClient],
	)
}
