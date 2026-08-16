import type { Chart } from "../model/types";

type ChartSelectProps = {
	charts: Chart[];
	selected: number;
	onSelect: (index: number) => void;
};

/** Difficulty picker. Hidden for single-chart files. */
export function ChartSelect({ charts, selected, onSelect }: ChartSelectProps) {
	if (charts.length < 2)
		return null;

	return (
		<div className="flex flex-wrap items-center gap-2 px-2 py-1">
			{charts.map((chart, i) => (
				<button
					key={i}
					className={`btn btn-xs ${i === selected ? "btn-primary" : "btn-ghost"}`}
					onClick={() => onSelect(i)}
				>
					{chart.metadata.version || `Chart ${i + 1}`}
				</button>
			))}
		</div>
	);
}
