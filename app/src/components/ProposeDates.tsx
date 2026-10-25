import { useState } from "react"
import { useSend, useStudios } from "../hooks/useTattoo"
import { toUnix } from "../lib/tattoo"
import { ErrorNotice, TxNotice } from "./TattooUI"

/**
 * Propose new dates at one of this artist's studios. Any artist of the studio
 * reviews them and accepts or declines.
 */
export const ProposeDates = ({ host }: { host: string }) => {
	const send = useSend()
	const studios = useStudios()
	const theirStudios = (studios.data ?? []).filter((s) =>
		s.members.includes(host),
	)
	const [studioId, setStudioId] = useState<number>()
	const [from, setFrom] = useState("")
	const [to, setTo] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	if (theirStudios.length === 0) {
		return (
			<div className="hint" onClick={(e) => e.stopPropagation()}>
				Todavía no tiene estudio para proponerle fechas.
			</div>
		)
	}
	const selected = studioId ?? theirStudios[0]!.id

	const propose = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const { hash } = await send((c, guest, o) =>
				c.propose_dates(
					{
						guest,
						studio_id: selected,
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
			{theirStudios.length > 1 && (
				<div className="field">
					<select
						aria-label="Estudio"
						value={selected}
						onChange={(e) => setStudioId(Number(e.target.value))}
					>
						{theirStudios.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({s.city})
							</option>
						))}
					</select>
				</div>
			)}
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
