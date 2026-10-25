import { useState } from "react"
import { Link } from "react-router-dom"
import { txLink } from "../hooks/useTattoo"
import { artistPhoto } from "../lib/photos"
import {
	type Artist,
	formatAvg,
	HOME_SWAP_MIN_AVG,
	HOME_SWAP_MIN_REVIEWS,
	isEstablished,
	missingBasics,
	reputationOf,
	type StudioTier,
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

/** A photo from public/fotos, or `fallback` when there is none yet */
export const Photo = ({
	src,
	alt,
	className,
	fallback,
}: {
	src: string
	alt: string
	className?: string
	fallback: React.ReactNode
}) => {
	const [failed, setFailed] = useState(false)
	if (failed) return <>{fallback}</>
	return (
		<img
			src={src}
			alt={alt}
			className={className}
			loading="lazy"
			onError={() => setFailed(true)}
		/>
	)
}

export const Avatar = ({ artist, big }: { artist: Artist; big?: boolean }) => (
	<div className={`avatar${big ? " big" : ""}`}>
		<Photo
			key={artist.name}
			src={artistPhoto(artist.name)}
			alt={artist.name}
			fallback={artist.name.slice(0, 1).toUpperCase()}
		/>
	</div>
)

/** Photo cover with its label: lime = studio, lavender = home (Sprint 4) */
export const Cover = ({
	kind,
	src,
	title,
	subtitle,
	children,
}: {
	kind: "studio" | "home"
	src: string
	title: string
	subtitle?: string
	children?: React.ReactNode
}) => (
	<div className={`cover cover-${kind}`}>
		<Photo
			key={src}
			src={src}
			alt={title}
			className="cover-img"
			fallback={
				<div className="cover-fallback">
					<span className="cover-icon" aria-hidden="true">
						{kind === "studio" ? "✒︎" : "⌂"}
					</span>
					<b>{title}</b>
					{subtitle && <small>{subtitle}</small>}
				</div>
			}
		/>
		<span
			className={`pill ${kind === "studio" ? "pill-lima" : "pill-lavender"}`}
		>
			{kind === "studio" ? "ESTUDIO" : "HOGAR"}
		</span>
		{children}
	</div>
)

/** Reputation is always black and white, so it never reads as studio or home */
export const TierBadge = ({ artist }: { artist: Artist }) =>
	isEstablished(artist) ? (
		<span className="pill pill-dark" title="3+ reseñas con promedio 4 o más">
			★ Establecidx
		</span>
	) : (
		<span className="pill pill-outline" title="Todavía construyendo reputación">
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
		<span className="stars">★</span> {formatAvg(artist)} · {artist.review_count}{" "}
		{artist.review_count === 1 ? "reseña" : "reseñas"}
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
			<div
				style={{
					display: "flex",
					gap: "0.5rem",
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
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
	const ring = "var(--gray-900)"
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
			<a
				className="tx-link"
				href={txLink(hash)}
				target="_blank"
				rel="noreferrer"
			>
				Ver transacción en stellar.expert ↗
			</a>
		)}
	</div>
)

export const ErrorNotice = ({ error }: { error?: string }) =>
	error ? <div className="alert alert-error">{error}</div> : null

/** Distingue de un vistazo los estudios que cumplen los requisitos básicos */
export const BasicsBadge = ({ spot }: { spot: { amenities: string[] } }) => {
	const missing = missingBasics(spot).length
	return missing === 0 ? (
		<span
			className="pill pill-outline"
			title="Declara todo el mobiliario y los insumos básicos de higiene y seguridad"
		>
			✓ Cumple básicos
		</span>
	) : (
		<span
			className="pill pill-warn"
			title="No declara todo el mobiliario o los insumos básicos: lleva los tuyos"
		>
			⚠ Faltan {missing} básico{missing > 1 ? "s" : ""}
		</span>
	)
}

const STUDIO_TIERS: Record<
	StudioTier,
	{ cls: string; text: string; title: string }
> = {
	establecido: {
		cls: "pill-dark",
		text: "★ Estudio establecido",
		title: "Sus propias reseñas: 3 o más con promedio 4 o más",
	},
	respaldado: {
		cls: "pill-outline-dark",
		text: "◆ Estudio respaldado",
		title: "Todavía nuevo, pero trabaja ahí al menos unx artista establecidx",
	},
	nuevo: {
		cls: "pill-outline",
		text: "✦ Estudio nuevo",
		title: "Todavía construyendo su reputación",
	},
}

/** The studio's own level, separate from its artists */
export const StudioTierBadge = ({ tier }: { tier: StudioTier }) => {
	const t = STUDIO_TIERS[tier]
	return (
		<span className={`pill ${t.cls}`} title={t.title}>
			{t.text}
		</span>
	)
}
