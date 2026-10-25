import { tattooGuestSpot } from "@stellar-scaffold/app-lib/clients"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useParams } from "react-router-dom"
import { StarPicker } from "../components/StarPicker"
import {
	ArtistRow,
	ErrorNotice,
	PageTitle,
	TxNotice,
} from "../components/TattooUI"
import { useArtist, useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { commitmentOf } from "../lib/tattoo"

const parseSecret = (hex?: string) => {
	try {
		return hex && /^[0-9a-f]+$/i.test(hex) ? BigInt(`0x${hex}`) : undefined
	} catch {
		return undefined
	}
}

const ClientReview = () => {
	const { secret: secretHex } = useParams()
	const secret = parseSecret(secretHex)
	const { address, startDemo, isPending } = useWallet()
	const send = useSend()

	const invite = useQuery({
		queryKey: ["invite", secretHex],
		enabled: secret !== undefined,
		queryFn: async () =>
			(await tattooGuestSpot.get_invite({ commitment: commitmentOf(secret!) }))
				.result ?? null,
	})
	const artist = useArtist(invite.data?.artist)

	const [score, setScore] = useState(5)
	const [comment, setComment] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()
	const [sent, setSent] = useState(false)

	if (secret === undefined) {
		return (
			<div className="alert alert-error">Este link de reseña no es válido.</div>
		)
	}
	if (invite.isLoading)
		return <div className="empty-state">Verificando el QR...</div>
	if (!invite.data) {
		return (
			<div className="alert alert-error">
				Este QR no está registrado en Stellar.
			</div>
		)
	}

	const submit = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const res = await send((c, client, opts) =>
				c.review_by_client({ client, secret, score, comment }, opts),
			)
			setHash(res.hash)
			setSent(true)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<PageTitle
				title="¿Cómo fue tu tatuaje?"
				subtitle="Tu reseña queda guardada en la blockchain de Stellar y ayuda a cuidar a la comunidad."
			/>
			<section className="ts-card">
				<div className="ts-card-body">
					{artist.data && <ArtistRow artist={artist.data} />}

					{invite.data.used && !sent ? (
						<div className="alert alert-info">
							Este QR ya se usó para dejar una reseña.
						</div>
					) : sent ? (
						<TxNotice
							hash={hash}
							text="¡Gracias! Tu reseña ya es parte del perfil del artista."
						/>
					) : !address ? (
						<div style={{ marginTop: "1rem" }}>
							<button
								className="btn-lime btn-block"
								disabled={isPending}
								onClick={() => void startDemo()}
							>
								{isPending ? "Preparando..." : "Empezar (sin registrarte)"}
							</button>
							<p className="hint">
								Creamos una cuenta anónima de testnet en tu navegador para
								firmar la reseña.
							</p>
						</div>
					) : (
						<div style={{ marginTop: "1rem" }}>
							<StarPicker value={score} onChange={setScore} />
							<div className="field" style={{ marginTop: "0.5rem" }}>
								<textarea
									rows={3}
									maxLength={200}
									placeholder="Cuéntanos tu experiencia: trato, higiene, resultado..."
									value={comment}
									onChange={(e) => setComment(e.target.value)}
								/>
							</div>
							<button
								className="btn-lavender btn-block"
								disabled={busy}
								onClick={() => void submit()}
							>
								{busy ? "Enviando..." : "Publicar reseña"}
							</button>
						</div>
					)}
					<ErrorNotice error={error} />
				</div>
			</section>
		</>
	)
}

export default ClientReview
