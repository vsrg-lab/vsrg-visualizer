import type { DifficultySummary } from "../../engine/stats";
import type { Chart } from "../../model/types";
import { formatCount } from "../format";

type ChartSelectProps = {
	charts: Chart[];
	/** Parallel to charts; index i summarizes charts[i]. */
	summaries: DifficultySummary[];
	selected: number;
	onSelect: (index: number) => void;
};

/** Difficulty list. The selection reads as a left indicator bar, never as an icon that shifts text. */
export function ChartSelect({ charts, summaries, selected, onSelect }: ChartSelectProps) {
	return (
		<ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2">
			{charts.map((chart, i) => {
				const summary = summaries[i];
				const active = i === selected;

				return (
					<li key={i}>
						<button
							type="button"
							className={`flex w-full items-center gap-2.5 rounded-md border-l-2 py-1.75 pr-2 pl-1.5 text-left transition-colors duration-120 ${
								active ? "border-l-accent-ui bg-surface-2" : "border-l-transparent hover:bg-hover"
							}`}
							onClick={() => onSelect(i)}
						>
							<span
								className={`flex-1 truncate text-[13px] ${
									active ? "font-medium text-strong" : "text-body/70"
								}`}
							>
								{chart.metadata.version || `Chart ${i + 1}`}
							</span>
							{summary && (
								<span className="shrink-0 font-mono text-[11px] tabular-nums text-micro">
									{summary.keys}K · {formatCount(summary.notes)} · {summary.npsAvg.toFixed(1)}
								</span>
							)}
						</button>
					</li>
				);
			})}
		</ul>
	);
}
