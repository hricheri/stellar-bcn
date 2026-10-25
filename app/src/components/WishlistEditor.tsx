import { EMPTY_TRIP, type Trip, type Wishlist } from "../lib/tattoo"
import { AmenityPicker } from "./AmenityPicker"

/** "Lo que busco": the cities and dates I want to travel to, and what I need */
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
			<div className="section-label">Mis viajes</div>
			{wish.trips.map((trip, i) => (
				<div className="field-row" key={i}>
					<div className="field" style={{ minWidth: 180 }}>
						<label htmlFor={`city-${i}`}>Ciudad</label>
						<input
							id={`city-${i}`}
							placeholder="Berlín, Lisboa..."
							value={trip.city}
							onChange={(e) => setTrip(i, { city: e.target.value })}
						/>
					</div>
					<div className="field">
						<label htmlFor={`from-${i}`}>Desde</label>
						<input
							id={`from-${i}`}
							type="date"
							value={trip.from}
							onChange={(e) => setTrip(i, { from: e.target.value })}
						/>
					</div>
					<div className="field">
						<label htmlFor={`to-${i}`}>Hasta</label>
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
							title="Quitar este viaje"
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
				+ Agregar otro viaje
			</button>

			<div className="section-label">Mis requisitos</div>
			<AmenityPicker
				selected={wish.wanted}
				onChange={(wanted) => onChange({ ...wish, wanted })}
			/>
			<p className="hint" style={{ marginTop: "0.85rem" }}>
				Match = ciudad (35%) + fechas que se solapan con tu viaje (35%) +
				equipamiento e insumos que buscas (30%). Con varios viajes, cada estudio
				se compara con el que mejor le encaja.
			</p>
		</>
	)
}
