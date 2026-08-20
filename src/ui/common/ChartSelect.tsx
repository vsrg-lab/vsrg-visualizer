import { Check } from "lucide-react";

import type { Chart } from "../../model/types";

type ChartSelectProps = {
	charts: Chart[];
	selected: number;
	onSelect: (index: number) => void;
};

/** Difficulty list. */
export function ChartSelect({ charts, selected, onSelect }: ChartSelectProps) {
	return (
		<ul className="space-y-0.5">
			{charts.map((chart, i) => (
				<li key={i}>
					<button
						type="button"
						className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
							i === selected
								? "bg-base-300 font-medium text-base-content"
								: "text-base-content/70 hover:bg-base-300/50 hover:text-base-content"
						}`}
						onClick={() => onSelect(i)}
					>
						{chart.metadata.version || `Chart ${i + 1}`}
						{i === selected && <Check size={14} />}
					</button>
				</li>
			))}
		</ul>
	);
}
