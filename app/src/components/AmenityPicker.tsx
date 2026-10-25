import { AMENITIES, type AmenityGroup, GROUP_LABELS } from "../lib/tattoo"

/** Chips to toggle furniture and supplies, grouped like in the Sprint 4 design */
export const AmenityPicker = ({
	selected,
	onChange,
}: {
	selected: string[]
	onChange: (next: string[]) => void
}) => {
	const toggle = (id: string) =>
		onChange(
			selected.includes(id)
				? selected.filter((a) => a !== id)
				: [...selected, id],
		)

	const groups = Object.keys(GROUP_LABELS) as AmenityGroup[]

	return (
		<>
			{groups.map((group) => {
				const items = AMENITIES.filter((a) => a.group === group)
				const allOn = items.every((a) => selected.includes(a.id))
				return (
					<div key={group}>
						<div className="section-label" style={{ display: "flex", gap: "0.5rem" }}>
							{GROUP_LABELS[group]}
							<button
								type="button"
								className="hint"
								style={{ border: "none", background: "none", padding: 0, textDecoration: "underline" }}
								onClick={() =>
									onChange(
										allOn
											? selected.filter((id) => !items.some((a) => a.id === id))
											: [...new Set([...selected, ...items.map((a) => a.id)])],
									)
								}
							>
								{allOn ? "quitar todos" : "marcar todos"}
							</button>
						</div>
						<div className="chips">
							{items.map((a) => (
								<button
									type="button"
									key={a.id}
									className={`chip-toggle${selected.includes(a.id) ? " on" : ""}`}
									onClick={() => toggle(a.id)}
								>
									{selected.includes(a.id) ? "✓ " : ""}
									{a.label}
								</button>
							))}
						</div>
					</div>
				)
			})}
		</>
	)
}
