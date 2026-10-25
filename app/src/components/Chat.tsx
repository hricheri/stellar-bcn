import { useEffect, useRef, useState } from "react"
import { useChat } from "../hooks/useChat"
import { type Artist, markSeen } from "../lib/tattoo"

/** Private messages between two artists */
export const Chat = ({
	me,
	other,
	canChat,
}: {
	me: string
	other: Artist
	canChat: boolean
}) => {
	const chat = useChat(other.address)
	const [text, setText] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const end = useRef<HTMLDivElement>(null)
	const count = chat.lines.length

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
			await chat.send(trimmed)
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
					<div
						className="hint"
						style={{ textAlign: "center", padding: "1rem" }}
					>
						{!chat.reachable
							? `${other.name} hasn't joined with an account yet, so they can't get messages.`
							: canChat
								? `Write to ${other.name} to sort out dates.`
								: "You can chat once you match. Established artists can write without a match."}
					</div>
				)}
				{chat.lines.map((m) => (
					<div key={m.key} className={`bubble${m.mine ? " mine" : ""}`}>
						{m.text}
					</div>
				))}
				<div ref={end} />
			</div>
			{canChat && chat.reachable && (
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
						placeholder="Write a message..."
						onChange={(e) => setText(e.target.value)}
						onClick={(e) => e.stopPropagation()}
					/>
					<button className="btn-lime" disabled={busy || !text.trim()}>
						{busy ? "..." : "Send"}
					</button>
				</form>
			)}
			{error && (
				<div className="hint" style={{ color: "var(--danger-600)" }}>
					{error}
				</div>
			)}
		</div>
	)
}
