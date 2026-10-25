import { useMemo, useState } from "react"
import { useArtists, useSend, useStudios } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import { homePhoto, studioPhoto } from "../lib/photos"
import {
	amenityLabel,
	type Artist,
	formatDate,
	type MatchResult,
	type Spot,
	SPOT_OPEN,
	studioAvg,
	studioTier,
} from "../lib/tattoo"
import { LikeButton } from "./LikeButton"
import {
	ArtistRow,
	BasicsBadge,
	Cover,
	ErrorNotice,
	MatchRing,
	StudioTierBadge,
	TxNotice,
} from "./TattooUI"

export const SpotCard = ({
	spot,
	host,
	match,
	me,
}: {
	spot: Spot
	host?: Artist
	match?: MatchResult
	me?: Artist | null
}) => {
	const { address } = useWallet()
	const send = useSend()
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string>()
	const [hash, setHash] = useState<string>()

	const studios = useStudios()
	const artists = useArtists()
	const isHome = spot.kind === "home"
	const homeOnly = spot.kind === "homeonly"
	const studio = (studios.data ?? []).find((s) => s.id === spot.studio_id)
	const tier = useMemo(
		() =>
			studio
				? studioTier(
						studio,
						new Map((artists.data ?? []).map((a) => [a.address, a])),
					)
				: undefined,
		[studio, artists.data],
	)
	const isMine = address === spot.host
	const open = spot.status === SPOT_OPEN

	const book = async () => {
		setBusy(true)
		setError(undefined)
		try {
			const { hash } = await send((c, guest, opts) =>
				c.book_spot({ guest, spot_id: spot.id }, opts),
			)
			setHash(hash)
		} catch (e) {
			setError((e as Error).message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<article className="ts-card">
			<Cover
				kind={homeOnly ? "home" : "studio"}
				src={
					homeOnly
						? homePhoto(host?.name ?? "")
						: studioPhoto(studio?.name ?? "")
				}
				title={
					homeOnly ? `${host?.name ?? ""}'s home` : (studio?.name ?? "Studio")
				}
				subtitle={spot.city}
			>
				{match && (
					<div className="cover-corner">
						<MatchRing percent={match.percent} />
					</div>
				)}
			</Cover>
			{isHome && (
				<Cover
					kind="home"
					src={homePhoto(host?.name ?? "")}
					title={`${host?.name ?? ""}'s home`}
					subtitle={spot.city}
				/>
			)}

			<div className="ts-card-body">
				<div className="chips" style={{ marginBottom: "0.6rem" }}>
					{!homeOnly && <BasicsBadge spot={spot} />}
					{tier && <StudioTierBadge tier={tier} />}
					{!open && <span className="pill pill-dark">Booked</span>}
				</div>
				<div className="meta" style={{ marginBottom: "0.75rem" }}>
					{studio && (
						<>
							🏠 <b>{studio.name}</b> · ⭐ {studioAvg(studio)} (
							{studio.review_count}{" "}
							{studio.review_count === 1 ? "review" : "reviews"}) ·{" "}
							{studio.members.length}{" "}
							{studio.members.length === 1 ? "artist" : "artists"}
							<br />
						</>
					)}
					📅 {formatDate(spot.start)} → {formatDate(spot.end)}
				</div>

				{host && (
					<ArtistRow
						artist={host}
						extra={<LikeButton artist={host.address} />}
					/>
				)}

				{match ? (
					<>
						{match.missing.length === 0 ? (
							<div className="chips" style={{ marginTop: "0.85rem" }}>
								<span className="chip chip-full">
									✓ 100% match on your must-haves
								</span>
							</div>
						) : (
							<>
								<div className="section-label missing">
									Missing ({match.missing.length})
								</div>
								<div className="chips">
									{match.missing.map((a) => (
										<span key={a} className="chip chip-missing">
											{amenityLabel(a)}
										</span>
									))}
								</div>
							</>
						)}
						{match.extras.length > 0 && (
							<>
								<div className="section-label has">Extras</div>
								<div className="chips">
									{match.extras.map((a) => (
										<span key={a} className="chip chip-has">
											{amenityLabel(a)}
										</span>
									))}
								</div>
							</>
						)}
						{(!match.cityOk || match.dateOverlap < 1) && (
							<div className="hint" style={{ marginTop: "0.6rem" }}>
								{!match.cityOk && "Another city. "}
								{match.dateOverlap < 1 &&
									`Covers ${Math.round(match.dateOverlap * 100)}% of your dates.`}
							</div>
						)}
					</>
				) : (
					<>
						<div className="section-label has">Offers</div>
						<div className="chips">
							{spot.amenities.map((a) => (
								<span key={a} className="chip chip-has">
									{amenityLabel(a)}
								</span>
							))}
						</div>
					</>
				)}

				<div className="spot-footer">
					<span className="hint">
						{isHome || homeOnly
							? "Only for established artists"
							: "Open to every artist"}
					</span>
					{open && !isMine && (
						<button
							className="btn-lime"
							onClick={() => void book()}
							disabled={busy || !address || !me}
							title={!me ? "Create your profile to book" : undefined}
						>
							{busy ? "Booking..." : "Book"}
						</button>
					)}
					{isMine && <span className="pill pill-gray">Your studio</span>}
				</div>
				<ErrorNotice error={error} />
				{hash && (
					<TxNotice
						hash={hash}
						text="Booked! The published dates are confirmed."
					/>
				)}
			</div>
		</article>
	)
}
