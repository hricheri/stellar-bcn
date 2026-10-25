import { useState } from "react"
import { useSend } from "../hooks/useTattoo"
import { useWallet } from "../hooks/useWallet"
import {
	amenityLabel,
	type Artist,
	formatDate,
	formatXlm,
	isEstablished,
	type MatchResult,
	type Spot,
	SPOT_OPEN,
} from "../lib/tattoo"
import { LikeButton } from "./LikeButton"
import {
	ArtistRow,
	BasicsBadge,
	ErrorNotice,
	MatchRing,
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

	const isHome = spot.kind === "home"
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
			<div className={`spot-cover${isHome ? " home" : ""}`}>
				<div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
					<span className="pill pill-lima">ESTUDIO</span>
					{isHome && <span className="pill pill-lavender">+ HOGAR</span>}
					<BasicsBadge spot={spot} />
					{host &&
						(isEstablished(host) ? (
							<span
								className="pill pill-lima"
								title="Su host tiene 3+ reseñas con promedio 4 o más"
							>
								★ ESTABLECIDO
							</span>
						) : (
							<span
								className="pill pill-lavender"
								title="Su host todavía está construyendo reputación"
							>
								✦ NUEVO
							</span>
						))}
					{!open && <span className="pill pill-dark">RESERVADO</span>}
				</div>
				{match && <MatchRing percent={match.percent} />}
				<div className="spot-city">{spot.city}</div>
			</div>

			<div className="ts-card-body">
				<div className="meta" style={{ marginBottom: "0.75rem" }}>
					📅 {formatDate(spot.start)} → {formatDate(spot.end)} · 💶{" "}
					{formatXlm(spot.price)}
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
						{isHome
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
						text="¡Reservado! El depósito queda en el contrato hasta que el host confirme la estancia."
					/>
				)}
			</div>
		</article>
	)
}
