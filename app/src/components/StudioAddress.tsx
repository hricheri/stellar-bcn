import { useState } from "react"
import {
	geocode,
	type Place,
	useMyStudioAddress,
	useSaveStudioAddress,
} from "../hooks/useStudioPlace"
import { AreaMap } from "./AreaMap"
import { ErrorNotice } from "./TattooUI"

// TATTOO APP: the studio's exact address, checked on a map. It stays
// private: other artists only see the general area.

export interface CheckedAddress {
	address: string
	place: Place
}

/** Address field + "Check on map"; calls onChecked once it's found */
export const AddressInput = ({
	initial = "",
	city,
	onChecked,
}: {
	initial?: string
	city?: string
	onChecked: (a?: CheckedAddress) => void
}) => {
	const [address, setAddress] = useState(initial)
	const [found, setFound] = useState<Place & { label: string }>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const check = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const q =
				city && !address.toLowerCase().includes(city.toLowerCase())
					? `${address}, ${city}`
					: address
			const place = await geocode(q)
			setFound(place)
			onChecked({ address: address.trim(), place })
		} catch (e) {
			setFound(undefined)
			onChecked(undefined)
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div>
			<div className="field-row">
				<div className="field" style={{ flex: 1 }}>
					<label htmlFor="studio-address">Exact address</label>
					<input
						id="studio-address"
						placeholder="Street and number"
						maxLength={300}
						value={address}
						onChange={(e) => {
							setAddress(e.target.value)
							setFound(undefined)
							onChecked(undefined)
						}}
					/>
				</div>
				<button
					type="button"
					className="btn-ghost"
					style={{ alignSelf: "flex-end" }}
					disabled={busy || address.trim().length < 3}
					onClick={() => void check()}
				>
					{busy ? "Looking..." : "📍 Check on map"}
				</button>
			</div>
			{found && (
				<>
					<AreaMap
						lat={found.lat}
						lng={found.lng}
						exact
						label={`Map of ${found.label}`}
					/>
					<p className="hint" style={{ margin: "0.3rem 0 0" }}>
						{found.label}. Is the pin right? If not, add more detail and check
						again. Other artists only see the area ({found.area || city}); the
						exact address goes in the chat once a stay is confirmed.
					</p>
				</>
			)}
			<ErrorNotice error={error} />
		</div>
	)
}

/** In a studio I already have: see or change its address */
export const StudioAddress = ({
	studioId,
	city,
}: {
	studioId: number
	city: string
}) => {
	const saved = useMyStudioAddress(studioId)
	const save = useSaveStudioAddress()
	const [editing, setEditing] = useState(false)
	const [checked, setChecked] = useState<CheckedAddress>()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	if (saved.isLoading) return null
	if (!editing && saved.data)
		return (
			<div>
				<AreaMap
					lat={saved.data.lat}
					lng={saved.data.lng}
					exact
					label={`Map of ${saved.data.address}`}
				/>
				<div className="field-row" style={{ marginTop: "0.4rem" }}>
					<span className="meta" style={{ flex: 1 }}>
						📍 {saved.data.address} <span className="hint">(private)</span>
					</span>
					<button className="btn-ghost" onClick={() => setEditing(true)}>
						Change
					</button>
				</div>
			</div>
		)

	return (
		<div>
			{!saved.data && (
				<div className="alert alert-info">
					Add the address so guests know where the studio is.
				</div>
			)}
			<AddressInput
				initial={saved.data?.address}
				city={city}
				onChecked={setChecked}
			/>
			<div className="field-row" style={{ marginTop: "0.5rem" }}>
				<button
					className="btn-lime"
					disabled={!checked || busy}
					onClick={() => {
						setBusy(true)
						setError(undefined)
						save(studioId, checked!.address, checked!.place)
							.then(() => setEditing(false))
							.catch((e: Error) => setError(e.message))
							.finally(() => setBusy(false))
					}}
				>
					{busy ? "Saving..." : "Save address"}
				</button>
				{saved.data && (
					<button className="btn-ghost" onClick={() => setEditing(false)}>
						Cancel
					</button>
				)}
			</div>
			<ErrorNotice error={error} />
		</div>
	)
}
