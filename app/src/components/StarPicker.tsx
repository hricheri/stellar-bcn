export const StarPicker = ({
	value,
	onChange,
}: {
	value: number
	onChange: (score: number) => void
}) => (
	<div className="star-picker" role="radiogroup" aria-label="Score">
		{[1, 2, 3, 4, 5].map((n) => (
			<button
				type="button"
				key={n}
				className={n <= value ? "on" : ""}
				aria-label={`${n} stars`}
				aria-checked={n === value}
				role="radio"
				onClick={() => onChange(n)}
			>
				★
			</button>
		))}
	</div>
)
