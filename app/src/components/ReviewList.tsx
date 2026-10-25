import { shortAddress } from "@stellar-scaffold/app-lib"
import { useArtists } from "../hooks/useTattoo"
import { formatDate, ROLE_LABELS, type Review, TAG_LABELS } from "../lib/tattoo"
import { Stars } from "./TattooUI"

const ROLE_TEXT = [
	"como host (le prestó su estudio)",
	"como guest (trabajó en su estudio)",
	"como cliente (verificado con QR)",
]

export const ReviewList = ({ reviews }: { reviews: Review[] }) => {
	const artists = useArtists()
	const names = new Map((artists.data ?? []).map((a) => [a.address, a.name]))

	if (reviews.length === 0) {
		return <div className="empty-state">Todavía no tiene reseñas.</div>
	}

	return (
		<div>
			{[...reviews].reverse().map((r, i) => (
				<div className="review" key={i}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							gap: "0.5rem",
							flexWrap: "wrap",
						}}
					>
						<Stars score={r.score} />
						<span
							className={`pill ${r.role === 2 ? "pill-lima" : "pill-lavender"}`}
						>
							{ROLE_LABELS[r.role]}
						</span>
					</div>
					{r.comment && <p style={{ margin: "0.35rem 0" }}>“{r.comment}”</p>}
					{r.tags.length > 0 && (
						<div className="chips" style={{ marginBottom: "0.35rem" }}>
							{r.tags.map((t) => (
								<span key={t} className="chip chip-extra">
									{TAG_LABELS[t] ?? t}
								</span>
							))}
						</div>
					)}
					<div className="hint">
						{names.get(r.from) ?? shortAddress(r.from)} {ROLE_TEXT[r.role]} ·{" "}
						{formatDate(r.timestamp)}
					</div>
				</div>
			))}
		</div>
	)
}
