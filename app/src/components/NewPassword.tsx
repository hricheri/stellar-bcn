import { useState } from "react"
import { useAuth } from "../hooks/useAuth"
import { ErrorNotice } from "./TattooUI"

/** After opening a "choose a new password" email link */
export const NewPassword = () => {
	const { recovering, updatePassword } = useAuth()
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	if (!recovering) return null

	const submit = async () => {
		setBusy(true)
		setError(undefined)
		try {
			await updatePassword(password)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="modal-backdrop">
			<form
				className="modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-password-title"
				onSubmit={(e) => {
					e.preventDefault()
					void submit()
				}}
			>
				<h2 id="new-password-title">Choose a new password</h2>
				<div className="field">
					<input
						type="password"
						autoComplete="new-password"
						aria-label="New password"
						placeholder="At least 8 characters"
						minLength={8}
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
				</div>
				<button
					className="btn-lime btn-block"
					disabled={busy || password.length < 8}
				>
					{busy ? "Saving..." : "Save password"}
				</button>
				<ErrorNotice error={error} />
			</form>
		</div>
	)
}
