import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { must, supabase, type VisitRequest } from "../lib/supabase"
import { useAuth } from "./useAuth"

// TATTOO APP: "I want to visit!" for studios with no free dates yet. The
// request is private (only the guest and the studio artist see it) and the
// studio answers by offering dates.

/** Requests I sent and requests sent to me */
export const useVisitRequests = () => {
	const { userId } = useAuth()
	return useQuery({
		queryKey: ["visit-requests", userId],
		enabled: !!userId,
		queryFn: async () =>
			must(
				await supabase
					.from("visit_requests")
					.select("*")
					.order("created_at", { ascending: false }),
			) as VisitRequest[],
	})
}

export const useVisitRequestActions = () => {
	const { userId } = useAuth()
	const queryClient = useQueryClient()
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: ["visit-requests"] })

	const send = useCallback(
		async (r: {
			host: string
			studio_id: number
			message: string
			start_date?: string
			end_date?: string
		}) => {
			if (!userId) throw new Error("Sign in first")
			must(
				await supabase
					.from("visit_requests")
					.insert({ ...r, guest: userId })
					.select("id"),
			)
			await refresh()
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[userId],
	)

	const setStatus = useCallback(
		async (id: number, status: VisitRequest["status"]) => {
			must(
				await supabase
					.from("visit_requests")
					.update({ status })
					.eq("id", id)
					.select("id"),
			)
			await refresh()
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	)

	return { send, setStatus }
}
