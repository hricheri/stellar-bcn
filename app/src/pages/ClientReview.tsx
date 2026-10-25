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
			<div className="alert alert-error">This review link isn't valid.</div>
		)
	}
	if (invite.isLoading)
		return <div className="empty-state">Checking the QR...</div>
	if (!invite.data) {
		return (
			<div className="alert alert-error">
				This QR isn't registered on Stellar.
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
				title="How was your tattoo?"
				subtitle="Your review is stored on the Stellar blockchain and helps keep the community safe."
			/>
			<section className="ts-card">
				<div className="ts-card-body">
					{artist.data && <ArtistRow artist={artist.data} />}

					{invite.data.used && !sent ? (
						<div className="alert alert-info">
							This QR was already used to leave a review.
						</div>
					) : sent ? (
						<TxNotice
							hash={hash}
							text="Thank you! Your review is now part of the artist's profile."
						/>
					) : !address ? (
						<div style={{ marginTop: "1rem" }}>
							<button
								className="btn-lime btn-block"
								disabled={isPending}
								onClick={() => void startDemo()}
							>
								{isPending ? "Getting ready..." : "Start (no sign-up)"}
							</button>
							<p className="hint">
								We create an anonymous testnet account in your browser to sign
								the review.
							</p>
						</div>
					) : (
						<div style={{ marginTop: "1rem" }}>
							<StarPicker value={score} onChange={setScore} />
							<div className="field" style={{ marginTop: "0.5rem" }}>
								<textarea
									rows={3}
									maxLength={200}
									placeholder="Tell us about it: care, hygiene, result..."
									value={comment}
									onChange={(e) => setComment(e.target.value)}
								/>
							</div>
							<button
								className="btn-lavender btn-block"
								disabled={busy}
								onClick={() => void submit()}
							>
								{busy ? "Sending..." : "Post review"}
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
