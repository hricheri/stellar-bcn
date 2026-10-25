import { useEffect, useRef, useState } from "react"
import { useMessages, useSend } from "../hooks/useTattoo"
import { type Artist, markSeen } from "../lib/tattoo"

/** Short messages stored in the contract, only between connected artists */
export const Chat = ({
	me,
	other,
	canChat,
}: {
	me: string
	other: Artist
	canChat: boolean
}) => {
	const messages = useMessages(me, other.address, true)
	const send = useSend()
	const [text, setText] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const end = useRef<HTMLDivElement>(null)
	const count = messages.data?.length ?? 0

	useEffect(() => {
		markSeen(me, other.address, count)
		end.current?.scrollIntoView({ block: "nearest" })
	}, [me, other.address, count])

	const submit = async () => {
		const trimmed = text.trim()
		if (!trimmed) return
		setBusy(true)
		setError(undefined)
		try {
			await send((c, from, o) =>
				c.send_message({ from, to: other.address, text: trimmed }, o),
			)
			setText("")
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="chat">
			<div className="chat-messages">
				{count === 0 && (
					<div className="hint" style={{ textAlign: "center", padding: "1rem" }}>
						{canChat
							? `Escríbele a ${other.name} para coordinar fechas.`
							: "Podrán chatear cuando haya match."}
					</div>
				)}
				{messages.data?.map((m, i) => (
					<div key={i} className={`bubble${m.from === me ? " mine" : ""}`}>
						{m.text}
					</div>
				))}
				<div ref={end} />
			</div>
			{canChat && (
				<form
					className="chat-input"
					onSubmit={(e) => {
						e.preventDefault()
						void submit()
					}}
				>
					<input
						value={text}
						maxLength={280}
						placeholder="Escribe un mensaje..."
						onChange={(e) => setText(e.target.value)}
						onClick={(e) => e.stopPropagation()}
					/>
					<button className="btn-lime" disabled={busy || !text.trim()}>
						{busy ? "..." : "Enviar"}
					</button>
				</form>
			)}
			{error && <div className="hint" style={{ color: "var(--danger-600)" }}>{error}</div>}
		</div>
	)
}
