import { useState } from "react"
import { useLikes, useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"

/** ♥ an artist. Mutual likes become a match (and unlock the chat). */
export const LikeButton = ({ artist }: { artist: string }) => {
	const { address } = useWallet()
	const likes = useLikes(address)
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [matched, setMatched] = useState(false)

	if (!address || address === artist) return null
	const liked = likes.data?.includes(artist)

	const like = async () => {
		setBusy(true)
		try {
			const { value } = await send((c, from, o) =>
				c.like_artist({ from, to: artist }, o),
			)
			setMatched(Boolean(value))
		} catch {
			// the profile may not exist yet; the button just stays as is
		} finally {
			setBusy(false)
		}
	}

	if (matched) return <span className="pill pill-dark">♥ ¡Match!</span>
	return (
		<button
			className={liked ? "btn-ghost" : "btn-lime"}
			disabled={busy || liked}
			onClick={(e) => {
				e.preventDefault()
				void like()
			}}
			title={liked ? "Ya le diste like" : "Dar like"}
		>
			{busy ? "..." : liked ? "♥" : "♡ Like"}
		</button>
	)
}
