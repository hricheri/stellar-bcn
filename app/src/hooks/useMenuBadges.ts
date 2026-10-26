import { isDropped, pendingActions } from "../lib/tattoo"
import { useAuth } from "./useAuth"
import { useUnread } from "./useChat"
import { useBookings, useStudios } from "./useTattoo"
import { useVisitRequests } from "./useVisitRequests"
import { useWallet } from "./useWallet"

// TATTOO APP: the numbers on the menu. Favorites: unread messages. Guest:
// things to do on my visits. Studio: requests and to-dos as a host.

export const useMenuBadges = () => {
	const { address } = useWallet()
	const { userId } = useAuth()
	const unread = useUnread()
	const bookings = useBookings(address)
	const studios = useStudios()
	const requests = useVisitRequests()

	const myStudios = new Set(
		(studios.data ?? [])
			.filter((s) => !!address && s.members.includes(address))
			.map((s) => s.id),
	)
	let guest = 0
	let studio = 0
	for (const b of bookings.data ?? []) {
		if (!address || isDropped(b)) continue
		const asGuest = b.guest === address
		const todo = pendingActions(
			b,
			address,
			!asGuest && myStudios.has(b.studio_id),
		).filter((a) => a !== "esperando_host").length
		if (asGuest) guest += todo
		else studio += todo
	}
	for (const r of requests.data ?? []) {
		if (r.host === userId && r.status === "open") studio += 1
		if (r.guest === userId && r.status === "answered") guest += 1
	}
	const favorites = [...(unread.data?.values() ?? [])].reduce(
		(n, x) => n + x,
		0,
	)
	return { favorites, guest, studio } as Record<string, number>
}
