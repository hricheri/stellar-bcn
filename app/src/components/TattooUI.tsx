import { Link } from "react-router-dom"
import { txLink } from "../hooks/useTattoo"
import {
	type Artist,
	formatAvg,
	HOME_SWAP_MIN_AVG,
	HOME_SWAP_MIN_REVIEWS,
	isEstablished,
	reputationOf,
} from "../lib/tattoo"

// TATTOO APP: piezas visuales compartidas entre pantallas

export const PageTitle = ({
	title,
	subtitle,
	children,
}: {
	title: string
	subtitle?: string
	children?: React.ReactNode
}) => (
	<div className="ts-page-title">
		<h1>{title}</h1>
		{subtitle && <p>{subtitle}</p>}
		{children}
	</div>
)

export const Avatar = ({ artist, big }: { artist: Artist; big?: boolean }) => (
	<div
		className={`avatar${big ? " big" : ""}${isEstablished(artist) ? " established" : ""}`}
	>
		{artist.name.slice(0, 1).toUpperCase()}
	</div>
)

export const TierBadge = ({ artist }: { artist: Artist }) =>
	isEstablished(artist) ? (
		<span className="pill pill-lima" title="3+ reseñas con promedio 4 o más">
			★ Establecidx
		</span>
	) : (
		<span className="pill pill-lavender" title="Todavía construyendo reputación">
			✦ Nuevx
		</span>
	)

export const Stars = ({ score }: { score: number }) => (
	<span className="stars" aria-label={`${score} de 5`}>
		{"★".repeat(score)}
		<span style={{ color: "var(--gray-200)" }}>{"★".repeat(5 - score)}</span>
	</span>
)

export const RatingLine = ({ artist }: { artist: Artist }) => (
	<span className="meta">
		<span className="stars">★</span> {formatAvg(artist)} ·{" "}
		{artist.review_count} {artist.review_count === 1 ? "reseña" : "reseñas"}
	</span>
)

export const ArtistRow = ({
	artist,
	extra,
}: {
	artist: Artist
	extra?: React.ReactNode
}) => (
	<div className="host-row">
		<Avatar artist={artist} />
		<div style={{ flex: 1, minWidth: 0 }}>
			<div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
				<Link to={`/artista/${artist.address}`} className="host-name">
					{artist.name}
				</Link>
				<TierBadge artist={artist} />
			</div>
			<div className="meta">
				{artist.city} · {artist.instagram}
			</div>
			<RatingLine artist={artist} />
		</div>
		{extra}
	</div>
)

/** Progress towards "estudio + hogar" */
export const HomeSwapProgress = ({ artist }: { artist: Artist }) => {
	const rep = reputationOf(artist)
	if (rep.home_swap_unlocked) {
		return (
			<div className="alert alert-ok">
				🏠 Estudio + hogar desbloqueado: ya puedes intercambiar también tu casa.
			</div>
		)
	}
	const pct = Math.min(100, (rep.review_count / HOME_SWAP_MIN_REVIEWS) * 100)
	return (
		<div>
			<div className="meta" style={{ marginBottom: "0.35rem" }}>
				🔒 Estudio + hogar: {Math.min(rep.review_count, HOME_SWAP_MIN_REVIEWS)}{" "}
				de {HOME_SWAP_MIN_REVIEWS} reseñas, con promedio {HOME_SWAP_MIN_AVG} o
				más
			</div>
			<div className="progress">
				<div style={{ width: `${pct}%` }} />
			</div>
		</div>
	)
}

export const MatchRing = ({ percent }: { percent: number }) => {
	const ring =
		percent >= 75
			? "var(--lima-400)"
			: percent >= 45
				? "var(--lavender-500)"
				: "var(--gray-400)"
	return (
		<div
			className="match-ring"
			style={{ "--p": percent, "--ring": ring } as React.CSSProperties}
			title="Match entre lo que buscas y este estudio"
		>
			<div>
				<span>
					{percent}%<small>match</small>
				</span>
			</div>
		</div>
	)
}

export const TxNotice = ({ hash, text }: { hash?: string; text: string }) => (
	<div className="alert alert-ok">
		{text}{" "}
		{hash && (
			<a className="tx-link" href={txLink(hash)} target="_blank" rel="noreferrer">
				Ver transacción en stellar.expert ↗
			</a>
		)}
	</div>
)

export const ErrorNotice = ({ error }: { error?: string }) =>
	error ? <div className="alert alert-error">{error}</div> : null
