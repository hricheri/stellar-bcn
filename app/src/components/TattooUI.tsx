import { useState } from "react"
import { Link } from "react-router-dom"
import { usePhotoUrl, useProfileOf } from "../hooks/useProfiles"
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

// TATTOO APP: visual pieces shared between screens

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

/** Their own photo (private, from their account), or a sample one */
export const Avatar = ({
	artist,
	big,
	xl,
}: {
	artist: Artist
	big?: boolean
	xl?: boolean
}) => {
	const own = usePhotoUrl(useProfileOf(artist.address)?.avatar_path)
	const src = own.data ?? artistPhoto(artist.name)
	return (
		<div className={`avatar${big ? " big" : ""}${xl ? " xl" : ""}`}>
			<Photo
				key={src}
				src={src}
				alt={artist.name}
				fallback={artist.name.slice(0, 1).toUpperCase()}
			/>
		</div>
	)
}

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
			{kind === "studio" ? "STUDIO" : "HOME"}
		</span>
		{children}
	</div>
)

/** Reputation is always black and white, so it never reads as studio or home */
export const TierBadge = ({ artist }: { artist: Artist }) =>
	isEstablished(artist) ? (
		<span className="pill pill-dark" title="3+ reviews averaging 4 or more">
			★ Established
		</span>
	) : (
		<span className="pill pill-outline" title="Still building their reputation">
			✦ Newbie
		</span>
	)

export const Stars = ({ score }: { score: number }) => (
	<span className="stars" aria-label={`${score} of 5`}>
		{"★".repeat(score)}
		<span style={{ color: "var(--gray-200)" }}>{"★".repeat(5 - score)}</span>
	</span>
)

/** Nothing until the first review: the Newbie badge already says it */
export const RatingLine = ({ artist }: { artist: Artist }) =>
	artist.review_count === 0 ? null : (
		<span className="meta">
			<span className="stars">★</span> {formatAvg(artist)} ·{" "}
			{artist.review_count} {artist.review_count === 1 ? "review" : "reviews"}
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

/** Progress towards "studio + home" */
export const HomeSwapProgress = ({ artist }: { artist: Artist }) => {
	const rep = reputationOf(artist)
	if (rep.home_swap_unlocked) {
		return (
			<div className="alert alert-ok">
				🏠 Studio + home unlocked: you can now offer your home too.
			</div>
		)
	}
	const pct = Math.min(100, (rep.review_count / HOME_SWAP_MIN_REVIEWS) * 100)
	return (
		<div>
			<div className="meta" style={{ marginBottom: "0.35rem" }}>
				🔒 Studio + home: {Math.min(rep.review_count, HOME_SWAP_MIN_REVIEWS)} of{" "}
				{HOME_SWAP_MIN_REVIEWS} reviews, averaging {HOME_SWAP_MIN_AVG} or more
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
			title="Match between what you're looking for and this studio"
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
				See the transaction on stellar.expert ↗
			</a>
		)}
	</div>
)

export const ErrorNotice = ({ error }: { error?: string }) =>
	error ? <div className="alert alert-error">{error}</div> : null

/** Shows at a glance which studios meet the basic requirements */
export const BasicsBadge = ({ spot }: { spot: { amenities: string[] } }) => {
	const missing = missingBasics(spot).length
	return missing === 0 ? (
		<span
			className="pill pill-outline"
			title="Declares all the basic furniture and hygiene and safety supplies"
		>
			✓ Meets basics
		</span>
	) : (
		<span
			className="pill pill-warn"
			title="Doesn't declare all the basic furniture or supplies: bring your own"
		>
			⚠ {missing} basic{missing > 1 ? "s" : ""} missing
		</span>
	)
}

const STUDIO_TIERS: Record<
	StudioTier,
	{ cls: string; text: string; title: string }
> = {
	establecido: {
		cls: "pill-dark",
		text: "★ Established studio",
		title: "Its own reviews: 3 or more averaging 4 or more",
	},
	respaldado: {
		cls: "pill-outline-dark",
		text: "◆ Backed studio",
		title: "Still new, but at least one established artist works there",
	},
	nuevo: {
		cls: "pill-outline",
		text: "✦ New studio",
		title: "Still building its reputation",
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

/** Our own calendar icon: dates guide the whole app */
export const CalendarIcon = ({ size = 22 }: { size?: number }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="4.5" width="18" height="16.5" rx="4.5" />
		<path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
		<circle cx="8.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
		<circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
		<rect
			x="14.3"
			y="12.7"
			width="3.2"
			height="5.6"
			rx="1.6"
			fill="currentColor"
			stroke="none"
		/>
		<circle cx="8.5" cy="17.4" r="1.1" fill="currentColor" stroke="none" />
		<circle cx="12" cy="17.4" r="1.1" fill="currentColor" stroke="none" />
	</svg>
)

const Outline = ({ children }: { children: React.ReactNode }) => (
	<svg
		width={20}
		height={20}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		{children}
	</svg>
)

export const PencilIcon = () => (
	<Outline>
		<path d="M16.9 3.6a2.1 2.1 0 0 1 3 3L8.5 18 4 19.5 5.5 15z" />
		<path d="M14.5 6l3.5 3.5" />
	</Outline>
)

export const EyeIcon = () => (
	<Outline>
		<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
		<circle cx="12" cy="12" r="3" />
	</Outline>
)
