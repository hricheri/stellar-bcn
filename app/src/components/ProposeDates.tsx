import { useState } from "react"
import { useSend } from "../hooks/useTattoo"
import { toUnix } from "../lib/tattoo"
import { ErrorNotice, TxNotice } from "./TattooUI"

/** Propose new dates at someone's studio; the host reviews and accepts or declines */
export const ProposeDates = ({ host }: { host: string }) => {
	const send = useSend()
	const [from, setFrom] = useState("")
	const [to, setTo] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	const propose = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const { hash } = await send((c, guest, o) =>
				c.propose_dates(
					{
						guest,
						host,
						start: BigInt(toUnix(from)),
						end: BigInt(toUnix(to)),
					},
					o,
				),
			)
			setHash(hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div onClick={(e) => e.stopPropagation()}>
			<div className="section-label">Proponer otras fechas</div>
			<div className="field-row">
				<div className="field">
					<input
						type="date"
						aria-label="Desde"
						value={from}
						onChange={(e) => setFrom(e.target.value)}
					/>
				</div>
				<div className="field">
					<input
						type="date"
						aria-label="Hasta"
						value={to}
						onChange={(e) => setTo(e.target.value)}
					/>
				</div>
				<button
					className="btn-lavender"
					disabled={busy || !from || !to}
					onClick={() => void propose()}
				>
					{busy ? "Enviando..." : "Proponer"}
				</button>
			</div>
			<ErrorNotice error={error} />
			{hash && (
				<TxNotice
					hash={hash}
					text="Propuesta enviada. El estudio la revisa y la acepta o la rechaza."
				/>
			)}
		</div>
	)
}
