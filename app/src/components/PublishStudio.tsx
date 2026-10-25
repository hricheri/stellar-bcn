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
	toUnix,
} from "../lib/tattoo"
import { AmenityPicker } from "./AmenityPicker"
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

const DateFields = () => (
	<div className="field-row">
		<div className="field">
			<label htmlFor="from">Libre desde</label>
			<input id="from" name="from" type="date" required />
		</div>
		<div className="field">
			<label htmlFor="to">Hasta</label>
			<input id="to" name="to" type="date" required />
		</div>
	</div>
)

const dates = (form: FormData) => ({
	start: BigInt(toUnix(String(form.get("from")))),
	end: BigInt(toUnix(String(form.get("to")))),
})

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
					{studio.review_count === 1 ? "reseña" : "reseñas"} del estudio)
				</div>
				<div className="hint" style={{ marginTop: "0.35rem" }}>
					La reputación del estudio es propia: la construyen las reseñas de lxs
					guests, aparte de la de cada artista.
				</div>

				<div className="section-label">Artistas del estudio</div>
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
							aria-label="Agregar artista"
							value={newArtist}
							onChange={(e) => setNewArtist(e.target.value)}
						>
							<option value="">Agregar otrx artista...</option>
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
						Agregar
					</button>
				</div>

				<div className="section-label">Mobiliario e insumos</div>
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
							Guardar insumos
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
							Editar insumos
						</button>
					</>
				)}
				<ErrorNotice error={action.error} />
				{action.hash && (
					<TxNotice hash={action.hash} text="Estudio actualizado." />
				)}
				{me.address !== studio.members[0] && (
					<div className="hint" style={{ marginTop: "0.5rem" }}>
						Te sumó {artists.get(studio.members[0]!)?.name ?? "otrx artista"}.
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
				<h2 style={{ marginBottom: "0.85rem" }}>Crear mi estudio</h2>
				<div className="field-row">
					<div className="field">
						<label htmlFor="name">Nombre del estudio</label>
						<input id="name" name="name" required />
					</div>
					<div className="field">
						<label htmlFor="city">Ciudad</label>
						<input id="city" name="city" required defaultValue={me.city} />
					</div>
				</div>
				<div className="section-label">¿Qué ofrece tu estudio?</div>
				<AmenityPicker selected={amenities} onChange={setAmenities} />
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={action.busy}
				>
					{action.busy ? "Creando..." : "Crear estudio"}
				</button>
				<ErrorNotice error={action.error} />
				{action.hash && (
					<TxNotice
						hash={action.hash}
						text="¡Estudio creado! Ya puedes publicar sus fechas libres y sumar a otrxs artistas."
					/>
				)}
			</form>
		</section>
	)
}

/** Publish free dates at one of my studios, or only my home if I'm trusted */
const PublishDates = ({ me, studios }: { me: Artist; studios: Studio[] }) => {
	const send = useSend()
	const action = useAction()
	const [studioId, setStudioId] = useState<number>()
	const [includeHome, setIncludeHome] = useState(false)
	const unlocked = reputationOf(me).home_swap_unlocked
	// 0 = solo mi hogar
	const selected = studioId ?? studios[0]?.id ?? 0
	const homeOnly = selected === 0

	if (studios.length === 0 && !unlocked) return null

	return (
		<section className="ts-card">
			<form
				className="ts-card-body"
				action={(form) =>
					action.run(() =>
						send((c, host, o) =>
							homeOnly
								? c.publish_home(
										{
											host,
											city: String(form.get("homecity")).trim(),
											...dates(form),
										},
										o,
									)
								: c.publish_spot(
										{
											host,
											studio_id: selected,
											include_home: includeHome,
											...dates(form),
										},
										o,
									),
						),
					)
				}
			>
				<h2 style={{ marginBottom: "0.85rem" }}>Publicar fechas libres</h2>
				<div className="field">
					<label htmlFor="studio">¿Qué ofreces?</label>
					<select
						id="studio"
						value={selected}
						onChange={(e) => setStudioId(Number(e.target.value))}
					>
						{studios.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({s.city})
							</option>
						))}
						{unlocked && <option value={0}>Solo mi hogar (sin estudio)</option>}
					</select>
				</div>
				{homeOnly && (
					<div className="field">
						<label htmlFor="homecity">Ciudad de tu hogar</label>
						<input
							id="homecity"
							name="homecity"
							required
							defaultValue={me.city}
						/>
					</div>
				)}
				<DateFields />
				{!homeOnly && (
					<label
						style={{
							display: "flex",
							gap: "0.5rem",
							alignItems: "center",
							fontWeight: 800,
						}}
					>
						<input
							type="checkbox"
							disabled={!unlocked}
							checked={includeHome}
							onChange={(e) => setIncludeHome(e.target.checked)}
						/>
						🏠 Incluir también mi hogar
					</label>
				)}
				<p className="hint" style={{ margin: "0.35rem 0 0" }}>
					{unlocked
						? "El hogar solo lo pueden reservar artistas establecidxs."
						: "Ofrecer tu hogar se desbloquea con 3 reseñas y promedio 4 o más."}
				</p>
				<button
					className="btn-lime btn-block"
					style={{ marginTop: "1rem" }}
					disabled={action.busy}
				>
					{action.busy ? "Publicando..." : "Publicar en Stellar"}
				</button>
				<ErrorNotice error={action.error} />
				{action.hash && (
					<TxNotice
						hash={action.hash}
						text="¡Publicado! Ya aparece en Explorar."
					/>
				)}
			</form>
		</section>
	)
}

/** "Mi estudio" inside the profile */
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
					¿Tienes estudio? Créalo para publicar sus fechas libres. Si no tienes,
					igual puedes viajar y reservar
					{reputationOf(me).home_swap_unlocked
						? ", o publicar solo tu hogar."
						: "."}
				</div>
			)}
			{creating || mine.length === 0 ? (
				<CreateStudio me={me} />
			) : (
				<button className="btn-ghost" onClick={() => setCreating(true)}>
					+ Crear otro estudio
				</button>
			)}
			<PublishDates me={me} studios={mine} />
		</>
	)
}
