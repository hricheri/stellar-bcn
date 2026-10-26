import { useState } from "react"
import {
	AMENITIES,
	type AmenityGroup,
	amenityLabel,
	customAmenityId,
	GROUP_LABELS,
} from "../lib/tattoo"

/** Chips to toggle furniture and supplies, grouped like in the Sprint 4 design */
export const AmenityPicker = ({
	selected,
	onChange,
	copyFrom,
}: {
	selected: string[]
	onChange: (next: string[]) => void
	/** "Copy from my studio": what my own studio has */
	copyFrom?: string[]
}) => {
	const [custom, setCustom] = useState("")
	const toggle = (id: string) =>
		onChange(
			selected.includes(id)
				? selected.filter((a) => a !== id)
				: [...selected, id],
		)

	const groups = Object.keys(GROUP_LABELS) as AmenityGroup[]
	const known = new Set(AMENITIES.map((a) => a.id))
	// The artist's own extra items, besides our list
	const own = [...new Set([...selected, ...(copyFrom ?? [])])].filter(
		(id) => !known.has(id),
	)

	// Ticked while what I need is exactly what my studio offers
	const sameAsStudio =
		!!copyFrom?.length &&
		copyFrom.length === selected.length &&
		copyFrom.every((id) => selected.includes(id))

	const addCustom = () => {
		const id = customAmenityId(custom)
		if (id && !selected.includes(id)) onChange([...selected, id])
		setCustom("")
	}

	return (
		<>
			{!!copyFrom?.length && (
				<div className="copy-from">
					<button
						type="button"
						className="hint"
						disabled={sameAsStudio}
						onClick={() => onChange([...copyFrom])}
					>
						{sameAsStudio ? "✓ Same as my studio" : "⧉ Copy from my studio"}
					</button>
				</div>
			)}
			{groups.map((group) => {
				const items = AMENITIES.filter((a) => a.group === group)
				const allOn = items.every((a) => selected.includes(a.id))
				return (
					<div key={group}>
						<div
							className="section-label"
							style={{ display: "flex", gap: "0.5rem" }}
						>
							{GROUP_LABELS[group]}
							<button
								type="button"
								className="hint"
								style={{
									border: "none",
									background: "none",
									padding: 0,
									textDecoration: "underline",
								}}
								onClick={() =>
									onChange(
										allOn
											? selected.filter((id) => !items.some((a) => a.id === id))
											: [...new Set([...selected, ...items.map((a) => a.id)])],
									)
								}
							>
								{allOn ? "clear all" : "mark all"}
							</button>
						</div>
						<div className="chips">
							{[
								...items.map((a) => a.id),
								...(group === "adicionales" ? own : []),
							].map((id) => (
								<button
									type="button"
									key={id}
									className={`chip-toggle${selected.includes(id) ? " on" : ""}`}
									onClick={() => toggle(id)}
								>
									{selected.includes(id) ? "✓ " : ""}
									{amenityLabel(id)}
								</button>
							))}
						</div>
						{group === "adicionales" && (
							<div className="field-row" style={{ marginTop: "0.5rem" }}>
								<div className="field" style={{ margin: 0 }}>
									<input
										aria-label="Another supply"
										placeholder="Something else? e.g. Tattoo foam"
										maxLength={32}
										value={custom}
										onChange={(e) => setCustom(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault()
												addCustom()
											}
										}}
									/>
								</div>
								<button
									type="button"
									className="btn-ghost"
									disabled={!customAmenityId(custom)}
									onClick={addCustom}
								>
									+ Add
								</button>
							</div>
						)}
					</div>
				)
			})}
		</>
	)
}
