import { useState } from "react"
import { useLike, useLikes } from "../hooks/useLikes"
import { useWallet } from "../hooks/useWallet"

/** ♥ an artist. Mutual likes become a match (and unlock the chat). */
export const LikeButton = ({ artist }: { artist: string }) => {
	const { address } = useWallet()
	const likes = useLikes()
	const likeArtist = useLike()
	const [busy, setBusy] = useState(false)
	const [matched, setMatched] = useState(false)

	if (!address || address === artist) return null
	const liked = likes.data?.includes(artist)

	const like = async () => {
		setBusy(true)
		try {
			setMatched(await likeArtist(artist))
		} catch {
			// the profile may not exist yet; the button just stays as is
		} finally {
			setBusy(false)
		}
	}

	if (matched) return <span className="pill pill-dark">♥ Match!</span>
	return (
		<button
			className={liked ? "btn-ghost" : "btn-lime"}
			disabled={busy || liked}
			onClick={(e) => {
				e.preventDefault()
				void like()
			}}
			title={liked ? "You already liked them" : "Like"}
		>
			{busy ? "..." : liked ? "♥" : "♡ Like"}
		</button>
	)
}
