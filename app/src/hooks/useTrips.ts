import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { DAY, daysBetween, toRanges } from "../components/DayPicker"
import { must, supabase, type Trip } from "../lib/supabase"
import { loadTravelDays, saveTravelDays } from "../lib/travel"
import { useAuth } from "./useAuth"

// TATTOO APP: the days I'd like to travel. With an account they're saved in
// Supabase (other members see them, to offer their studio); without one,
// only in this browser.

const toDate = (unix: number) =>
	new Date(unix * 1000).toISOString().slice(0, 10)
const toUnix = (date: string) => Date.parse(`${date}T00:00:00Z`) / 1000

/** Every day of some trips, as midnight UTC unix times */
export const tripDays = (trips: Trip[]) =>
	trips.flatMap((t) => daysBetween(toUnix(t.start_date), toUnix(t.end_date)))

/** All members' trips (for favorites and alerts) */
export const useAllTrips = () => {
	const { session } = useAuth()
	return useQuery({
		queryKey: ["trips", "all", session?.user.id],
		enabled: !!session,
		queryFn: async () =>
			must(
				await supabase
					.from("trips")
					.select("*")
					.gte("end_date", toDate(Date.now() / 1000)),
			) as Trip[],
	})
}

/** My travel days and a function to replace them */
export const useTravelDays = () => {
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	const mine = useQuery({
		queryKey: ["trips", "mine", userId],
		queryFn: async () =>
			userId
				? tripDays(
						must(
							await supabase.from("trips").select("*").eq("user_id", userId),
						) as Trip[],
					)
				: loadTravelDays(),
	})

	const save = useCallback(
		async (days: number[]) => {
			if (!userId) {
				saveTravelDays(days)
			} else {
				must(await supabase.from("trips").delete().eq("user_id", userId))
				const rows = toRanges(days).map((r) => ({
					user_id: userId,
					start_date: toDate(r.start),
					// toRanges makes one-day ranges end one second later
					end_date: toDate(r.end - (r.end % DAY)),
				}))
				if (rows.length) must(await supabase.from("trips").insert(rows))
			}
			await queryClient.invalidateQueries({ queryKey: ["trips"] })
		},
		[userId, queryClient],
	)

	return { days: mine.data ?? [], save, loading: mine.isLoading }
}
