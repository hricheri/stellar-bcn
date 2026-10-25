import { useMemo, useState } from "react"
import { useArtists, useSend, useStudios } from "../hooks/useTattoo"
import {
	amenityLabel,
	type Artist,
	DEFAULT_WANTED,
	reputationOf,
	type Studio,
	studioAvg,
	studioTier,
} from "../lib/tattoo"
import { AmenityPicker } from "./AmenityPicker"
import { AvailabilityCalendar } from "./AvailabilityCalendar"
import { ErrorNotice, StudioTierBadge, TxNotice } from "./TattooUI"

/** Runs a contract call and keeps its busy / error / tx state */
const useAction = () => {
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const run = async (fn: () => Promise<{ hash?: string }>) => {
		setBusy(true)
		setError(undefined)
		setHash(undefined)
		try {
			setHash((await fn()).hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}
	return { busy, error, hash, run }
}

/** One studio I work at: its own reputation, its artists and its supplies */
const StudioPanel = ({
	studio,
	me,
	artists,
}: {
	studio: Studio
	me: Artist
	artists: Map<string, Artist>
}) => {
	const send = useSend()
	const action = useAction()
	const [editing, setEditing] = useState(false)
	const [amenities, setAmenities] = useState<string[]>(studio.amenities)
	const [newArtist, setNewArtist] = useState("")
	const others = [...artists.values()].filter(
		(a) => !studio.members.includes(a.address),
	)

	return (
		<section className="ts-card">
			<div className="ts-card-body">
				<div className="split-title" style={{ margin: 0 }}>
					<h2>🏠 {studio.name}</h2>
					<StudioTierBadge tier={studioTier(studio, artists)} />
				</div>
				<div className="meta">
					{studio.city} · ⭐ {studioAvg(studio)} ({studio.review_count}{" "}
					{studio.review_count === 1 ? "review" : "reviews"} of the studio)
				</div>
				<div className="hint" style={{ marginTop: "0.35rem" }}>
					The studio has its own reputation, built from guests' reviews,
					separate from each artist's.
				</div>

				<div className="section-label">Studio artists</div>
				<div className="chips">
					{studio.members.map((m) => (
						<span key={m} className="chip chip-has">
							{artists.get(m)?.name ?? m.slice(0, 6)}
						</span>
					))}
				</div>
				<div className="field-row" style={{ marginTop: "0.5rem" }}>
					<div className="field">
						<select
							aria-label="Add an artist"
							value={newArtist}
							onChange={(e) => setNewArtist(e.target.value)}
						>
							<option value="">Add another artist...</option>
							{others.map((a) => (
								<option key={a.address} value={a.address}>
									{a.name} ({a.city})
								</option>
							))}
						</select>
					</div>
					<button
						className="btn-ghost"
						disabled={!newArtist || action.busy}
						onClick={() =>
							void action.run(() =>
								send((c, member, o) =>
									c.add_studio_artist(
										{ member, studio_id: studio.id, artist: newArtist },
										o,
									),
								),
							)
						}
					>
						Add
					</button>
				</div>

				<div className="section-label">Furniture and supplies</div>
				{editing ? (
					<>
						<AmenityPicker selected={amenities} onChange={setAmenities} />
						<button
							className="btn-lavender"
							style={{ marginTop: "0.5rem" }}
							disabled={action.busy}
							onClick={() =>
								void action
									.run(() =>
										send((c, member, o) =>
											c.update_studio_amenities(
												{ member, studio_id: studio.id, amenities },
												o,
											),
										),
									)
									.then(() => setEditing(false))
							}
						>
							Save supplies
						</button>
					</>
				) : (
					<>
						<div className="chips">
							{studio.amenities.map((a) => (
								<span key={a} className="chip chip-has">
									{amenityLabel(a)}
								</span>
							))}
						</div>
						<button
							className="btn-ghost"
							style={{ marginTop: "0.5rem" }}
							onClick={() => setEditing(true)}
						>
							Edit supplies
						</button>
					</>
				)}
				<ErrorNotice error={action.error} />
				{action.hash && <TxNotice hash={action.hash} text="Studio updated." />}
				{me.address !== studio.members[0] && (
					<div className="hint" style={{ marginTop: "0.5rem" }}>
						Added by {artists.get(studio.members[0]!)?.name ?? "another artist"}
						.
					</div>
				)}
			</div>
		</section>
	)
}

const CreateStudio = ({ me }: { me: Artist }) => {
	const send = useSend()
	const action = useAction()
	const [amenities, setAmenities] = useState<string[]>(DEFAULT_WANTED)
	return (
		<section className="ts-card">
			<form
				className="ts-card-body"
				action={(form) =>
					action.run(() =>
						send((c, owner, o) =>
							c.create_studio(
								{
									owner,
									name: String(form.get("name")).trim(),
									city: String(form.get("city")).trim(),
									amenities,
								},
								o,
							),
						),
					)
				}
			>
				<h2 style={{ marginBottom: "0.85rem" }}>Create my studio</h2>
				<div className="field-row">
					<div className="field">
						<label htmlFor="name">Studio name</label>
						<input id="name" name="name" required />
					</div>
					<div className="field">
						<label htmlFor="city">City</label>
						<input id="city" name="city" required defaultValue={me.city} />
					</div>
				</div>
				<div className="section-label">What does your studio offer?</div>
				<AmenityPicker selected={amenities} onChange={setAmenities} />
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={action.busy}
				>
					{action.busy ? "Creating..." : "Create studio"}
				</button>
				<ErrorNotice error={action.error} />
				{action.hash && (
					<TxNotice
						hash={action.hash}
						text="Studio created! You can now publish its free dates and add other artists."
					/>
				)}
			</form>
		</section>
	)
}

/** "My studio" inside the profile */
export const PublishStudio = ({ me }: { me: Artist }) => {
	const studios = useStudios()
	const artists = useArtists()
	const [creating, setCreating] = useState(false)
	const byAddress = useMemo(
		() => new Map((artists.data ?? []).map((a) => [a.address, a])),
		[artists.data],
	)
	const mine = (studios.data ?? []).filter((s) =>
		s.members.includes(me.address),
	)

	return (
		<>
			{mine.map((s) => (
				<StudioPanel key={s.id} studio={s} me={me} artists={byAddress} />
			))}
			{mine.length === 0 && !creating && (
				<div className="ts-card empty-state">
					Do you have a studio? Create it to publish its free dates. If you
					don't, you can still travel and book
					{reputationOf(me).home_swap_unlocked
						? ", or publish only your home."
						: "."}
				</div>
			)}
			{creating || mine.length === 0 ? (
				<CreateStudio me={me} />
			) : (
				<button className="btn-ghost" onClick={() => setCreating(true)}>
					+ Create another studio
				</button>
			)}
			<AvailabilityCalendar me={me} studios={mine} />
		</>
	)
}
