import { useMemo, useState } from "react"
import { useArtists, useSend, useStudios } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	amenityLabel,
	type Artist,
	formatDate,
	isEstablished,
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
	// Studios show their own level; a home-only spot shows its artist's level
	const tierClass = tier
		? {
				establecido: " tier-established",
				respaldado: " tier-backed",
				nuevo: " tier-new",
			}[tier]
		: host
			? isEstablished(host)
				? " tier-established"
				: " tier-new"
			: ""
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
		<article className={`ts-card${tierClass}`}>
			<div className={`spot-cover${isHome || homeOnly ? " home" : ""}`}>
				<div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
					{homeOnly ? (
						<span className="pill pill-lavender">SOLO HOGAR</span>
					) : (
						<span className="pill pill-lima">ESTUDIO</span>
					)}
					{isHome && <span className="pill pill-lavender">+ HOGAR</span>}
					{!homeOnly && <BasicsBadge spot={spot} />}
					{tier && <StudioTierBadge tier={tier} />}
					{!open && <span className="pill pill-dark">RESERVADO</span>}
				</div>
				{match && <MatchRing percent={match.percent} />}
				<div className="spot-city">{spot.city}</div>
			</div>

			<div className="ts-card-body">
				<div className="meta" style={{ marginBottom: "0.75rem" }}>
					{studio && (
						<>
							🏠 <b>{studio.name}</b> · ⭐ {studioAvg(studio)} (
							{studio.review_count}{" "}
							{studio.review_count === 1 ? "reseña" : "reseñas"}) ·{" "}
							{studio.members.length}{" "}
							{studio.members.length === 1 ? "artista" : "artistas"}
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
								<span className="pill pill-lima">
									✓ Tiene todo lo que buscas
								</span>
							</div>
						) : (
							<>
								<div className="section-label missing">
									Falta ({match.missing.length})
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
								{!match.cityOk && "Otra ciudad. "}
								{match.dateOverlap < 1 &&
									`Cubre el ${Math.round(match.dateOverlap * 100)}% de tus fechas.`}
							</div>
						)}
					</>
				) : (
					<>
						<div className="section-label has">Ofrece</div>
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
							? "Solo para artistas establecidxs"
							: "Abierto a todxs lxs artistas"}
					</span>
					{open && !isMine && (
						<button
							className="btn-lime"
							onClick={() => void book()}
							disabled={busy || !address || !me}
							title={!me ? "Crea tu perfil para reservar" : undefined}
						>
							{busy ? "Reservando..." : "Reservar"}
						</button>
					)}
					{isMine && <span className="pill pill-gray">Tu estudio</span>}
				</div>
				<ErrorNotice error={error} />
				{hash && (
					<TxNotice
						hash={hash}
						text="¡Reservado! Las fechas publicadas quedan confirmadas."
					/>
				)}
			</div>
		</article>
	)
}
