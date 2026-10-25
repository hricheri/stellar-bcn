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
				<PageTitle title="Client reviews" />
				<div className="alert alert-info">
					First <Link to="/perfil">create your profile</Link>.
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
				title="Client reviews"
				subtitle="When a session ends, show this QR to your client. It works only once."
			/>

			<section className="ts-card">
				<div className="ts-card-body">
					{!invite ? (
						<div className="qr-box">
							<p>
								Each QR carries a random secret. On Stellar we only store its{" "}
								<b>Poseidon</b> hash, so nobody can make up reviews or reuse a
								QR.
							</p>
							<button
								className="btn-lime"
								disabled={busy}
								onClick={() => void create()}
							>
								{busy ? "Generating..." : "Generate a QR for a client"}
							</button>
						</div>
					) : (
						<div className="qr-box">
							<img src={invite.qr} alt="QR to leave a review" />
							<p style={{ margin: 0 }}>
								Your client scans it with their phone camera. No wallet or
								account needed.
							</p>
							<a
								href={invite.link}
								target="_blank"
								rel="noreferrer"
								className="tx-link"
							>
								Open the review link ↗
							</a>
							<TxNotice hash={invite.hash} text="Commitment stored on-chain." />
							<code style={{ fontSize: "0.65rem", wordBreak: "break-all" }}>
								Poseidon(secret) = 0x{invite.commitment}
							</code>
							<button
								className="btn-ghost"
								onClick={() => setInvite(undefined)}
							>
								Generate another
							</button>
						</div>
					)}
					<ErrorNotice error={error} />
				</div>
			</section>

			<section className="ts-card">
				<div className="ts-card-body">
					<h3 style={{ marginBottom: "0.5rem" }}>How does it work?</h3>
					<ol className="meta" style={{ paddingLeft: "1.2rem", margin: 0 }}>
						<li>Your browser makes a secret and computes Poseidon(secret).</li>
						<li>
							Only the hash is stored in the contract, linked to your profile.
						</li>
						<li>
							The client reveals the secret when reviewing; the contract
							recomputes the hash with Stellar's native Poseidon function
							(BN254) and marks it as used.
						</li>
					</ol>
				</div>
			</section>
		</>
	)
}

export default ClientInvite
