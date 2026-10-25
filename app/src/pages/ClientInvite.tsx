import QRCode from "qrcode"
import { useState } from "react"
import { Link } from "react-router-dom"
import { ErrorNotice, PageTitle, TxNotice } from "../components/TattooUI"
import { useArtist, useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { commitmentOf, inviteLink, newInviteSecret } from "../lib/tattoo"

const ClientInvite = () => {
	const { address } = useWallet()
	const me = useArtist(address)
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [invite, setInvite] = useState<{
		link: string
		qr: string
		commitment: string
		hash?: string
	}>()

	if (!me.data) {
		return (
			<>
				<PageTitle title="Reseñas de clientes" />
				<div className="alert alert-info">
					Primero <Link to="/perfil">crea tu perfil</Link>.
				</div>
			</>
		)
	}

	const create = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const secret = newInviteSecret()
			const commitment = commitmentOf(secret)
			const { hash } = await send((c, artist, opts) =>
				c.create_client_invite({ artist, commitment }, opts),
			)
			const link = inviteLink(secret)
			const qr = await QRCode.toDataURL(link, {
				margin: 1,
				width: 480,
				color: { dark: "#111827", light: "#ffffff" },
			})
			setInvite({ link, qr, commitment: commitment.toString(16), hash })
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<PageTitle
				title="Reseñas de clientes"
				subtitle="Al terminar una sesión, muéstrale este QR a tu cliente. Solo sirve una vez."
			/>

			<section className="ts-card">
				<div className="ts-card-body">
					{!invite ? (
						<div className="qr-box">
							<p>
								Cada QR lleva un secreto aleatorio. En Stellar solo guardamos su
								hash <b>Poseidon</b>, así nadie puede inventar reseñas ni
								reutilizar un QR.
							</p>
							<button className="btn-lime" disabled={busy} onClick={() => void create()}>
								{busy ? "Generando..." : "Generar QR para un cliente"}
							</button>
						</div>
					) : (
						<div className="qr-box">
							<img src={invite.qr} alt="QR para dejar una reseña" />
							<p style={{ margin: 0 }}>
								Que tu cliente lo escanee con la cámara del móvil. No necesita
								wallet ni cuenta.
							</p>
							<a href={invite.link} target="_blank" rel="noreferrer" className="tx-link">
								Abrir el link de reseña ↗
							</a>
							<TxNotice hash={invite.hash} text="Compromiso registrado on-chain." />
							<code style={{ fontSize: "0.65rem", wordBreak: "break-all" }}>
								Poseidon(secreto) = 0x{invite.commitment}
							</code>
							<button className="btn-ghost" onClick={() => setInvite(undefined)}>
								Generar otro
							</button>
						</div>
					)}
					<ErrorNotice error={error} />
				</div>
			</section>

			<section className="ts-card">
				<div className="ts-card-body">
					<h3 style={{ marginBottom: "0.5rem" }}>¿Cómo funciona?</h3>
					<ol className="meta" style={{ paddingLeft: "1.2rem", margin: 0 }}>
						<li>Tu navegador genera un secreto y calcula Poseidon(secreto).</li>
						<li>Solo el hash se guarda en el contrato, asociado a tu perfil.</li>
						<li>
							El cliente revela el secreto al reseñar; el contrato recalcula el
							hash con la función Poseidon nativa de Stellar (BN254) y lo marca
							como usado.
						</li>
					</ol>
				</div>
			</section>
		</>
	)
}

export default ClientInvite
