import { daysBetween } from "../components/DayPicker"
import { type Spot, SPOT_OPEN } from "./tattoo"

// TATTOO APP: the days I'd like to travel, marked in the Calendar. They drive
// the "Matching dates" filter and the alerts about favorites.

const KEY = "tattoo-travel-days"

export const loadTravelDays = (): number[] => {
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "[]") as number[]
	} catch {
		return []
	}
}

export const saveTravelDays = (days: number[]) => {
	try {
		localStorage.setItem(KEY, JSON.stringify([...days].sort((a, b) => a - b)))
	} catch {
		// no storage: only for this visit
	}
}

/** Every free day of some open spots */
export const freeDays = (spots: Spot[]) =>
	new Set(
		spots
			.filter((s) => s.status === SPOT_OPEN)
			.flatMap((s) => daysBetween(Number(s.start), Number(s.end))),
	)

/** How many of my travel days a set of free days covers */
export const sharedDays = (travel: number[], free: Set<number>) =>
	travel.filter((d) => free.has(d)).length
