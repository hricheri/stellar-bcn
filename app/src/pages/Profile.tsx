import { useState } from "react"
import { Link } from "react-router-dom"
import { PublishStudio } from "../components/PublishStudio"
import { ReviewList } from "../components/ReviewList"
import { SpotCard } from "../components/SpotCard"
import {
	Avatar,
	ErrorNotice,
	HomeSwapProgress,
	PageTitle,
	RatingLine,
	TierBadge,
} from "../components/TattooUI"
import { useArtist, useReviews, useSend, useSpots } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"

const RegisterForm = () => {
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()

	const submit = async (form: FormData) => {
		setBusy(true)
		setError(undefined)
		try {
			await send((c, artist, opts) =>
				c.register_artist(
					{
						artist,
						name: String(form.get("name") ?? "").trim(),
						city: String(form.get("city") ?? "").trim(),
						instagram: String(form.get("instagram") ?? "").trim(),
					},
					opts,
				),
			)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="ts-card">
			<form className="ts-card-body" action={submit}>
				<h2 style={{ marginBottom: "0.85rem" }}>Crea tu perfil de artista</h2>
				<div className="field">
					<label htmlFor="name">Nombre artístico</label>
					<input id="name" name="name" required maxLength={40} />
				</div>
				<div className="field-row">
					<div className="field">
						<label htmlFor="city">Ciudad de tu estudio</label>
						<input id="city" name="city" required maxLength={40} />
					</div>
					<div className="field">
						<label htmlFor="instagram">Instagram</label>
						<input
							id="instagram"
							name="instagram"
							placeholder="@"
							maxLength={40}
						/>
					</div>
				</div>
				<button className="btn-lime btn-block" disabled={busy}>
					{busy ? "Creando..." : "Crear perfil en Stellar"}
				</button>
				<ErrorNotice error={error} />
			</form>
		</section>
	)
}

const Profile = () => {
	const { address } = useWallet()
	const me = useArtist(address)
	const reviews = useReviews(address)
	const spots = useSpots()
	const [publishing, setPublishing] = useState(false)

	if (!address) {
		return (
			<>
				<PageTitle title="Mi perfil" />
				<div className="alert alert-info">
					Conecta tu wallet o toca <b>Probar sin wallet</b> arriba para crear tu
					perfil en testnet.
				</div>
			</>
		)
	}

	if (me.isLoading) return <div className="empty-state">Cargando...</div>
	if (!me.data) {
		return (
			<>
				<PageTitle
					title="Bienvenidx"
					subtitle="Tu perfil y tu reputación quedan guardados en Stellar."
				/>
				<RegisterForm />
			</>
		)
	}

	const a = me.data
	const mySpots = (spots.data ?? []).filter((s) => s.host === a.address)

	return (
		<>
			<section className="ts-card">
				<div className="ts-card-body">
					<div className="host-row">
						<Avatar artist={a} big />
						<div style={{ flex: 1 }}>
							<h1 style={{ fontSize: "1.8rem" }}>{a.name}</h1>
							<div
								className="meta"
								style={{ color: "var(--lavender-700)", fontWeight: 700 }}
							>
								{a.city} · {a.instagram}
							</div>
							<div
								style={{
									display: "flex",
									gap: "0.5rem",
									alignItems: "center",
									marginTop: "0.25rem",
									flexWrap: "wrap",
								}}
							>
								<TierBadge artist={a} />
								<RatingLine artist={a} />
							</div>
						</div>
					</div>
					<div style={{ marginTop: "1rem" }}>
						<HomeSwapProgress artist={a} />
					</div>
					<div className="field-row" style={{ marginTop: "1rem" }}>
						<a href="#mi-estudio" style={{ flex: 1 }}>
							<button className="btn-lime btn-block">Mi estudio</button>
						</a>
						<Link to="/clientes" style={{ flex: 1 }}>
							<button className="btn-ghost btn-block">QR para clientes</button>
						</Link>
						<Link to={`/artista/${a.address}`} style={{ flex: 1 }}>
							<button className="btn-ghost btn-block">Vista pública</button>
						</Link>
					</div>
				</div>
			</section>

			<div className="ts-card">
				<div
					className="ts-card-body"
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						gap: "0.75rem",
						flexWrap: "wrap",
					}}
				>
					<span>
						Tus matches, swaps, chats y calendario están en un solo lugar.
					</span>
					<Link to="/swaps">
						<button className="btn-lavender">Ir a mis swaps</button>
					</Link>
				</div>
			</div>

			<div className="split-title" id="mi-estudio">
				<h2>Mi estudio</h2>
				<button
					className="btn-ghost"
					onClick={() => setPublishing(!publishing)}
				>
					{publishing ? "Cerrar" : "+ Publicar fechas libres"}
				</button>
			</div>
			{publishing && <PublishStudio me={a} />}
			{mySpots.length === 0 && !publishing && (
				<div className="ts-card empty-state">
					Si tienes estudio, publica las fechas en que queda libre. Si no
					tienes, igual puedes viajar y reservar.
				</div>
			)}
			{mySpots.map((s) => (
				<SpotCard key={s.id} spot={s} host={a} me={a} />
			))}

			<div className="split-title">
				<h2>Mis reseñas</h2>
				<span className="hint">
					Guardadas en Stellar, nadie puede borrarlas
				</span>
			</div>
			<section className="ts-card">
				<div className="ts-card-body">
					<ReviewList reviews={reviews.data ?? []} />
				</div>
			</section>
		</>
	)
}

export default Profile
