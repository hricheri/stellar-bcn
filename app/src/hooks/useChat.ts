import { useQueryClient, useQuery } from "@tanstack/react-query"
import { useCallback, useEffect } from "react"
import { type ChatMessage, must, supabase } from "../lib/supabase"
import { useAuth } from "./useAuth"
import { useProfileOf } from "./useProfiles"
import { useMessages, useSend } from "./useTattoo"
import { useWallet } from "./useWallet"

// TATTOO APP: private chat. With an account, messages live in Supabase and
// only the two people in the chat can read them; new ones arrive live.
// Without Supabase set up, the old Stellar messages are used.

export interface Line {
	key: string
	mine: boolean
	text: string
}

export const useChat = (other: string) => {
	const { address } = useWallet()
	const { ready, userId } = useAuth()
	const them = useProfileOf(other)
	const queryClient = useQueryClient()
	const chain = useMessages(ready ? undefined : address, other, true)
	const sendTx = useSend()
	const key = ["chat", userId, them?.id]

	const live = useQuery({
		queryKey: key,
		enabled: ready && !!userId && !!them,
		queryFn: async () =>
			must(
				await supabase
					.from("messages")
					.select("*")
					.or(
						`and(sender.eq.${userId},recipient.eq.${them!.id}),and(sender.eq.${them!.id},recipient.eq.${userId})`,
					)
					.order("created_at"),
			) as ChatMessage[],
	})

	// New messages from them arrive live; mark them as read
	useEffect(() => {
		if (!ready || !userId || !them) return
		const channel = supabase
			.channel(`chat-${userId}-${them.id}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "messages",
					filter: `recipient=eq.${userId}`,
				},
				() => void queryClient.invalidateQueries({ queryKey: key }),
			)
			.subscribe()
		return () => void supabase.removeChannel(channel)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ready, userId, them?.id])

	const unread = (live.data ?? []).filter(
		(m) => m.recipient === userId && !m.read_at,
	).length
	useEffect(() => {
		if (!unread || !them || !userId) return
		void supabase
			.from("messages")
			.update({ read_at: new Date().toISOString() })
			.eq("recipient", userId)
			.eq("sender", them.id)
			.is("read_at", null)
			.then(() => queryClient.invalidateQueries({ queryKey: ["unread"] }))
	}, [unread, them, userId, queryClient])

	const send = useCallback(
		async (text: string) => {
			if (!ready) {
				await sendTx((c, from, o) =>
					c.send_message({ from, to: other, text }, o),
				)
				return
			}
			if (!userId || !them) throw new Error("They can't get messages yet.")
			must(
				await supabase
					.from("messages")
					.insert({ sender: userId, recipient: them.id, body: text })
					.select("id"),
			)
			await queryClient.invalidateQueries({ queryKey: key })
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ready, userId, them?.id, other, sendTx, queryClient],
	)

	const lines: Line[] = ready
		? (live.data ?? []).map((m) => ({
				key: String(m.id),
				mine: m.sender === userId,
				text: m.body,
			}))
		: (chain.data ?? []).map((m, i) => ({
				key: String(i),
				mine: m.from === address,
				text: m.text,
			}))

	return {
		lines,
		send,
		/** false when they have no account to receive messages */
		reachable: !ready || !!them,
	}
}

/** How many unread messages I have, from each sender (Stellar address) */
export const useUnread = () => {
	const { ready, userId } = useAuth()
	return useQuery({
		queryKey: ["unread", userId],
		enabled: ready && !!userId,
		refetchInterval: 30_000,
		queryFn: async () =>
			(
				must(
					await supabase
						.from("messages")
						.select("sender")
						.eq("recipient", userId!)
						.is("read_at", null),
				) as { sender: string }[]
			).length,
	})
}
