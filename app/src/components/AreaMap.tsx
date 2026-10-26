// TATTOO APP: a small OpenStreetMap. "area" shows the neighbourhood with a
// soft circle and no pin; "exact" puts a pin on the address (only for the
// studio's own artist, when they check where it is).

export const AreaMap = ({
	lat,
	lng,
	exact = false,
	label,
}: {
	lat: number
	lng: number
	exact?: boolean
	label: string
}) => {
	const d = exact ? 0.004 : 0.02
	const src =
		`https://www.openstreetmap.org/export/embed.html?bbox=${lng - d * 1.6},${lat - d},${lng + d * 1.6},${lat + d}&layer=mapnik` +
		(exact ? `&marker=${lat},${lng}` : "")
	return (
		<div className={`area-map${exact ? "" : " approx"}`}>
			<iframe title={label} src={src} loading="lazy" />
			{!exact && <span className="area-circle" aria-hidden="true" />}
			{/* The embed's own footer is cut off; OpenStreetMap still needs credit */}
			<a
				className="area-credit"
				href="https://www.openstreetmap.org/copyright"
				target="_blank"
				rel="noreferrer"
			>
				© OpenStreetMap
			</a>
		</div>
	)
}
