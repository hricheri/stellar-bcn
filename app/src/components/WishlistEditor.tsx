import { EMPTY_TRIP, type Trip, type Wishlist } from "../lib/tattoo"
import { AmenityPicker } from "./AmenityPicker"

/** "What I'm looking for": the cities and dates I want to travel to, and what I need */
export const WishlistEditor = ({
	wish,
	onChange,
}: {
	wish: Wishlist
	onChange: (next: Wishlist) => void
}) => {
	const setTrip = (i: number, patch: Partial<Trip>) =>
		onChange({
			...wish,
			trips: wish.trips.map((t, n) => (n === i ? { ...t, ...patch } : t)),
		})

	return (
		<>
			<div className="section-label">My trips</div>
			{wish.trips.map((trip, i) => (
				<div className="field-row" key={i}>
					<div className="field" style={{ minWidth: 180 }}>
						<label htmlFor={`city-${i}`}>City</label>
						<input
							id={`city-${i}`}
							placeholder="Berlin, Lisbon..."
							value={trip.city}
							onChange={(e) => setTrip(i, { city: e.target.value })}
						/>
					</div>
					<div className="field">
						<label htmlFor={`from-${i}`}>From</label>
						<input
							id={`from-${i}`}
							type="date"
							value={trip.from}
							onChange={(e) => setTrip(i, { from: e.target.value })}
						/>
					</div>
					<div className="field">
						<label htmlFor={`to-${i}`}>To</label>
						<input
							id={`to-${i}`}
							type="date"
							value={trip.to}
							onChange={(e) => setTrip(i, { to: e.target.value })}
						/>
					</div>
					{wish.trips.length > 1 && (
						<button
							className="btn-ghost"
							title="Remove this trip"
							onClick={() =>
								onChange({
									...wish,
									trips: wish.trips.filter((_, n) => n !== i),
								})
							}
						>
							✕
						</button>
					)}
				</div>
			))}
			<button
				className="btn-ghost"
				onClick={() =>
					onChange({ ...wish, trips: [...wish.trips, EMPTY_TRIP] })
				}
			>
				+ Add another trip
			</button>

			<div className="section-label">What I need</div>
			<AmenityPicker
				selected={wish.wanted}
				onChange={(wanted) => onChange({ ...wish, wanted })}
			/>
			<p className="hint" style={{ marginTop: "0.85rem" }}>
				Match = city (35%) + dates that overlap your trip (35%) + furniture and
				supplies you need (30%). With several trips, each studio is compared
				with the one that fits it best.
			</p>
		</>
	)
}
