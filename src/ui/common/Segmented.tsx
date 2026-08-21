type SegmentedOption<T extends string | number> = {
	value: T;
	label: string;
};

type SegmentedProps<T extends string | number> = {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** "grow" splits the full width between segments; "compact" sizes each to its label. */
	variant: "grow" | "compact";
	label: string;
};

/** Always-visible choice of two to four values; the active one needs no click to be read. */
export function Segmented<T extends string | number>({
	options,
	value,
	onChange,
	variant,
	label
}: SegmentedProps<T>) {
	const grow = variant === "grow";

	return (
		<div className="flex gap-0.5 rounded-md bg-surface-2 p-0.5" role="group" aria-label={label}>
			{options.map(option => {
				const active = option.value === value;

				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={active}
						onClick={() => onChange(option.value)}
						className={`flex items-center justify-center rounded transition-colors duration-[120ms] ${
							grow ? "h-[26px] flex-1 text-[12px]" : "h-6 px-[9px] font-mono text-[11px]"
						} ${
							active
								? `bg-surface-3 text-strong ${grow ? "font-medium" : ""}`
								: `${grow ? "text-dim" : "text-body/50"} hover:text-strong`
						}`}
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
