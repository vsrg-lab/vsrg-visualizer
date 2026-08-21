import { PanelFrame } from "./PanelFrame";
import { SectionLabel } from "./SectionLabel";
import type { ScrollMode } from "../../engine/flatten";
import type { ChartStats, NoteDensity } from "../../engine/stats";
import { INSPECTOR_PX } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { useChartStore } from "../../store/chart";
import { useSettingsStore } from "../../store/settings";
import { ChartIdentity } from "../common/ChartIdentity";
import { Segmented } from "../common/Segmented";
import { StatGrid } from "../common/StatGrid";
import { Warnings } from "../common/Warnings";

const SCROLL_MODES: { value: ScrollMode; label: string }[] = [
	{ value: "original", label: "Original" },
	{ value: "noSv", label: "No SV" }
];

/** Each press of the stepper, matching the up/down arrow keys. */
const SPEED_STEP = 0.05;

type RightPanelProps = {
	chart: Chart;
	stats: ChartStats;
	density: NoteDensity;
	durationMs: number;
};

/** Right inspector - "what this chart is": identity, statistics, warnings and the view controls. */
export function RightPanel({ chart, stats, density, durationMs }: RightPanelProps) {
	const warnings = useChartStore(state => state.set?.warnings ?? []);
	const reroll = useChartStore(state => state.reroll);

	const scrollMode = useSettingsStore(state => state.scrollMode);
	const setScrollMode = useSettingsStore(state => state.setScrollMode);
	const scrollSpeed = useSettingsStore(state => state.scrollSpeed);
	const bumpScrollSpeed = useSettingsStore(state => state.bumpScrollSpeed);

	const rerollable = warnings.some(warning => warning.code === "random-branch");

	return (
		<PanelFrame side="right" width={INSPECTOR_PX}>
			<div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-hidden px-3.5 py-4">
				<ChartIdentity chart={chart} durationMs={durationMs} />
				<StatGrid chart={chart} stats={stats} density={density} />

				{warnings.length > 0 && (
					<div className="flex min-h-0 flex-col gap-2">
						<div className="flex items-center justify-between">
							<SectionLabel>WARNINGS · {warnings.length}</SectionLabel>
							{rerollable && (
								<button
									type="button"
									className="text-[11px] text-micro transition-colors duration-[120ms] hover:text-strong"
									onClick={reroll}
								>
									Reroll
								</button>
							)}
						</div>
						<Warnings warnings={warnings} />
					</div>
				)}

				<div className="mt-auto flex shrink-0 flex-col gap-2.5">
					<SectionLabel>VIEW</SectionLabel>
					<Segmented
						label="Scroll mode"
						variant="grow"
						options={SCROLL_MODES}
						value={scrollMode}
						onChange={setScrollMode}
					/>
					<div className="flex items-center gap-2.5">
						<span className="flex-1 text-[12px] text-dim">Scroll speed</span>
						<div className="flex items-center gap-0.5">
							<button
								type="button"
								aria-label="Slower"
								className="flex size-[22px] items-center justify-center rounded bg-surface-2 font-mono text-[13px] text-body/70 transition-colors duration-[120ms] hover:bg-hover-strong"
								onClick={() => bumpScrollSpeed(-SPEED_STEP)}
							>
								−
							</button>
							<span className="w-11 text-center font-mono text-[13px] tabular-nums text-strong">
								{scrollSpeed.toFixed(2)}
							</span>
							<button
								type="button"
								aria-label="Faster"
								className="flex size-[22px] items-center justify-center rounded bg-surface-2 font-mono text-[13px] text-body/70 transition-colors duration-[120ms] hover:bg-hover-strong"
								onClick={() => bumpScrollSpeed(SPEED_STEP)}
							>
								+
							</button>
						</div>
					</div>
				</div>
			</div>
		</PanelFrame>
	);
}
