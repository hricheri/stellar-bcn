import { connectWallet, disconnectWallet } from "@stellar-scaffold/app-lib"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import { useArtist } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"

// TATTOO APP: no money moves here. The account is only your identity: every
// like, booking and review is signed with it, so nobody can fake your reputation.
export const WalletButton = () => {
	const auth = useAuth()
	if (auth.ready) return <AccountButton />
	return <DemoButton />
}

/** With Supabase: log in with email, or your name and Log out */
const AccountButton = () => {
	const { session, profile, signOut } = useAuth()
	if (!session)
		return (
			<Link to="/entrar" className="btn-primary">
				Sign in
			</Link>
		)
	return (
		<div className="wallet-connected">
			<Link to="/perfil" className="wallet-profile">
				{profile?.name || session.user.email}
			</Link>
			<button className="btn-ghost" onClick={() => void signOut()}>
				Log out
			</button>
		</div>
	)
}

/** Without Supabase (local tests): the in-browser demo account */
const DemoButton = () => {
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
					Log out
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
			setError("That key isn't valid. It starts with S and has 56 characters.")
		}
	}

	return (
		<div className="entry">
			<button
				className="btn-primary"
				onClick={() => setOpen(!open)}
				disabled={isPending}
			>
				Sign in
			</button>
			{open && (
				<div className="entry-menu">
					<p className="hint" style={{ margin: 0 }}>
						Your account is your signature: your likes, bookings and reviews are
						stored under your name on Stellar. No money moves.
					</p>
					<button
						className="btn-lime"
						onClick={() => {
							setOpen(false)
							void startDemo()
						}}
					>
						Create a new account
					</button>
					<div className="section-label" style={{ margin: "0.3rem 0 0" }}>
						Sign in as a sample artist
					</div>
					<input
						type="password"
						placeholder="Secret key (S...)"
						value={secret}
						onChange={(e) => {
							setSecret(e.target.value)
							setError(undefined)
						}}
					/>
					<button className="btn-ghost" onClick={enter} disabled={!secret}>
						Sign in with key
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
						I already have a Stellar wallet
					</button>
				</div>
			)}
		</div>
	)
}
