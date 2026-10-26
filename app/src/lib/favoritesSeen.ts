// TATTOO APP: what I already saw of each favorite (their dates, trips and
// reviews), so Favorites and Explore can tell what's new. Kept in this browser.

const SEEN_KEY = "tattoo-favorites-seen"

export interface Seen {
	spots: number[]
	reviews: number
	trips: string[]
}

export const loadSeen = (): Record<string, Seen> => {
	try {
		return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<
			string,
			Seen
		>
	} catch {
		return {}
	}
}

export const saveSeen = (who: string, s: Seen) => {
	const all = loadSeen()
	all[who] = s
	try {
		localStorage.setItem(SEEN_KEY, JSON.stringify(all))
	} catch {
		// Private mode: news just show again next time
	}
}


/** I just liked them in Explore: what they have now isn't news */
export const seenOnLike = (who: string, spots: number[], reviews: number) => {
	const before = loadSeen()[who]
	saveSeen(who, {
		spots: [...new Set([...(before?.spots ?? []), ...spots])],
		reviews: before?.reviews ?? reviews,
		trips: before?.trips ?? [],
	})
}
