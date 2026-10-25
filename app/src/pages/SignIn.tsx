import { useState } from "react"
import { Navigate } from "react-router-dom"
import { ErrorNotice, PageTitle } from "../components/TattooUI"
import { useAuth } from "../hooks/useAuth"

type Mode = "in" | "up" | "forgot"

/** Log in or create an account with email and password */
const SignIn = () => {
	const { session, signIn, signUp, resetPassword } = useAuth()
	const [mode, setMode] = useState<Mode>("in")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [sent, setSent] = useState<string>()

	if (session) return <Navigate to="/perfil" replace />

	const submit = async () => {
		setBusy(true)
		setError(undefined)
		try {
			if (mode === "in") await signIn(email, password)
			else if (mode === "up") {
				if ((await signUp(email, password)) === "confirm")
					setSent(
						`We sent a link to ${email}. Open it to confirm your account, then log in here.`,
					)
			} else {
				await resetPassword(email)
				setSent(`We sent a link to ${email} to choose a new password.`)
			}
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<>
			<PageTitle
				title={
					mode === "up"
						? "Create your account"
						: mode === "forgot"
							? "Forgot your password?"
							: "Welcome back"
				}
				subtitle="Your photos, trips and chats are private: only people with an account can see them."
			/>
			<section className="ts-card auth-card">
				<form
					className="ts-card-body"
					onSubmit={(e) => {
						e.preventDefault()
						void submit()
					}}
				>
					{mode !== "forgot" && (
						<div className="filter-grid" style={{ marginBottom: "1rem" }}>
							<button
								type="button"
								className={`filter-btn${mode === "in" ? " on" : ""}`}
								onClick={() => setMode("in")}
							>
								Log in
							</button>
							<button
								type="button"
								className={`filter-btn${mode === "up" ? " on" : ""}`}
								onClick={() => setMode("up")}
							>
								Create account
							</button>
						</div>
					)}
					<div className="field">
						<label htmlFor="email">Email</label>
						<input
							id="email"
							type="email"
							required
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>
					{mode !== "forgot" && (
						<div className="field">
							<label htmlFor="password">Password</label>
							<input
								id="password"
								type="password"
								required
								minLength={8}
								autoComplete={
									mode === "up" ? "new-password" : "current-password"
								}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
							{mode === "up" && (
								<span className="hint">At least 8 characters.</span>
							)}
						</div>
					)}
					<button className="btn-lime btn-block" disabled={busy}>
						{busy
							? "..."
							: mode === "in"
								? "Log in"
								: mode === "up"
									? "Create account"
									: "Send me a link"}
					</button>
					<ErrorNotice error={error} />
					{sent && <div className="alert alert-ok">{sent}</div>}
					<button
						type="button"
						className="link-btn"
						onClick={() => {
							setMode(mode === "forgot" ? "in" : "forgot")
							setSent(undefined)
							setError(undefined)
						}}
					>
						{mode === "forgot" ? "← Back to log in" : "Forgot your password?"}
					</button>
				</form>
			</section>
		</>
	)
}

export default SignIn
