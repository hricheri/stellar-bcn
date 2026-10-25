import { connectWallet, disconnectWallet } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { useArtist } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"

// TATTOO APP: no money moves here. The account is only your identity: every
// like, booking and review is signed with it, so nobody can fake your reputation.
export const WalletButton = () => {
	const { address, isPending, isDemo, startDemo, enterWithSecret, stopDemo } =
		useWallet()
	const me = useArtist(address)
	const [open, setOpen] = useState(false)
	const [secret, setSecret] = useState("")
	const [error, setError] = useState<string>()

	if (address) {
		return (
			<div
				className="wallet-connected"
				style={{ opacity: isPending ? 0.6 : 1 }}
			>
				<span className="wallet-profile" title={address}>
					{me.data?.name ?? `${address.slice(0, 4)}…${address.slice(-4)}`}
				</span>
				<button
					className="btn-ghost"
					onClick={() => (isDemo ? stopDemo() : void disconnectWallet())}
				>
					Salir
				</button>
			</div>
		)
	}

	const enter = () => {
		try {
			enterWithSecret(secret)
			setOpen(false)
			setSecret("")
		} catch {
			setError("Esa clave no es válida. Empieza con S y tiene 56 caracteres.")
		}
	}

	return (
		<div className="entry">
			<button
				className="btn-primary"
				onClick={() => setOpen(!open)}
				disabled={isPending}
			>
				Entrar
			</button>
			{open && (
				<div className="entry-menu">
					<p className="hint" style={{ margin: 0 }}>
						Tu cuenta es tu firma: tus likes, reservas y reseñas quedan a tu
						nombre en Stellar. No se mueve dinero.
					</p>
					<button
						className="btn-lime"
						onClick={() => {
							setOpen(false)
							void startDemo()
						}}
					>
						Crear cuenta nueva
					</button>
					<div className="section-label" style={{ margin: "0.3rem 0 0" }}>
						Entrar como artista del ejemplo
					</div>
					<input
						type="password"
						placeholder="Clave secreta (S...)"
						value={secret}
						onChange={(e) => {
							setSecret(e.target.value)
							setError(undefined)
						}}
					/>
					<button className="btn-ghost" onClick={enter} disabled={!secret}>
						Entrar con clave
					</button>
					{error && <div className="alert alert-error">{error}</div>}
					<button
						className="btn-ghost"
						style={{ fontSize: "0.8rem" }}
						onClick={() => {
							setOpen(false)
							void connectWallet()
						}}
					>
						Ya tengo una wallet de Stellar
					</button>
				</div>
			)}
		</div>
	)
}
