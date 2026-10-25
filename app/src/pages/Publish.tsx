import { useState } from "react"
import { Link } from "react-router-dom"
import { AmenityPicker } from "../components/AmenityPicker"
import { ErrorNotice, PageTitle, TxNotice } from "../components/TattooUI"
import { useArtist, useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { DEFAULT_WANTED, reputationOf, STROOPS, toUnix } from "../lib/tattoo"

const Publish = () => {
	const { address } = useWallet()
	const me = useArtist(address)
	const send = useSend()
	const [amenities, setAmenities] = useState<string[]>(DEFAULT_WANTED)
	const [includeHome, setIncludeHome] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	if (!me.data) {
		return (
			<>
				<PageTitle title="Publicar mi estudio" />
				<div className="alert alert-info">
					Primero <Link to="/perfil">crea tu perfil</Link>.
				</div>
			</>
		)
	}

	const unlocked = reputationOf(me.data).home_swap_unlocked

	const submit = async (form: FormData) => {
		setBusy(true)
		setError(undefined)
		setHash(undefined)
		try {
			const from = String(form.get("from"))
			const to = String(form.get("to"))
			const deposit = Number(form.get("deposit") || 0)
			const res = await send((c, host, opts) =>
				c.publish_spot(
					{
						host,
						city: String(form.get("city")).trim(),
						start: BigInt(toUnix(from)),
						end: BigInt(toUnix(to)),
						price: BigInt(Math.round(deposit * Number(STROOPS))),
						include_home: includeHome,
						amenities,
					},
					opts,
				),
			)
			setHash(res.hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<PageTitle
				title="Publicar mi estudio"
				subtitle="Cuando viajas, tu estudio queda libre: ofrécelo a otrx artista."
			/>
			<section className="ts-card">
				<form className="ts-card-body" action={submit}>
					<div className="field">
						<label htmlFor="city">Ciudad</label>
						<input id="city" name="city" required defaultValue={me.data.city} />
					</div>
					<div className="field-row">
						<div className="field">
							<label htmlFor="from">Libre desde</label>
							<input id="from" name="from" type="date" required />
						</div>
						<div className="field">
							<label htmlFor="to">Hasta</label>
							<input id="to" name="to" type="date" required />
						</div>
						<div className="field">
							<label htmlFor="deposit">Depósito (XLM)</label>
							<input id="deposit" name="deposit" type="number" min="0" step="1" defaultValue="0" />
						</div>
					</div>

					<div className="section-label">¿Qué ofrece tu estudio?</div>
					<AmenityPicker selected={amenities} onChange={setAmenities} />

					<div className="ts-card" style={{ marginTop: "1rem", background: "var(--lavender-50)", boxShadow: "none" }}>
						<div className="ts-card-body">
							<label style={{ display: "flex", gap: "0.5rem", alignItems: "center", fontWeight: 800 }}>
								<input
									type="checkbox"
									disabled={!unlocked}
									checked={includeHome}
									onChange={(e) => setIncludeHome(e.target.checked)}
								/>
								🏠 Incluir también mi hogar
							</label>
							<p className="hint" style={{ margin: "0.35rem 0 0" }}>
								{unlocked
									? "Solo artistas establecidxs podrán reservarlo."
									: "Se desbloquea cuando tengas 3 reseñas con promedio 4 o más."}
							</p>
						</div>
					</div>

					<button className="btn-lime btn-block" style={{ marginTop: "1rem" }} disabled={busy}>
						{busy ? "Publicando..." : "Publicar en Stellar"}
					</button>
					<ErrorNotice error={error} />
					{hash && (
						<TxNotice hash={hash} text="¡Publicado! Ya aparece en Explorar." />
					)}
				</form>
			</section>
		</>
	)
}

export default Publish
