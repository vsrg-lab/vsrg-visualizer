import { PanelFrame } from "./PanelFrame";
import { PanelSection } from "./PanelSection";
import type { Chart } from "../../model/types";
import { useChartStore } from "../../store/chart";
import { SCROLL_SPEED_MAX, SCROLL_SPEED_MIN, useSettingsStore } from "../../store/settings";
import { ChartInfo } from "../common/ChartInfo";
import { Warnings } from "../common/Warnings";

type RightPanelProps = {
	chart: Chart;
};

/** Right sidebar - "how to look at it": metadata, warnings, reroll and scroll settings. */
export function RightPanel({ chart }: RightPanelProps) {
	const warnings = useChartStore(state => state.set?.warnings ?? []);
	const reroll = useChartStore(state => state.reroll);

	const scrollMode = useSettingsStore(state => state.scrollMode);
	const setScrollMode = useSettingsStore(state => state.setScrollMode);
	const scrollSpeed = useSettingsStore(state => state.scrollSpeed);
	const setScrollSpeed = useSettingsStore(state => state.setScrollSpeed);

	return (
		<PanelFrame side="right">
			<PanelSection title="Chart">
				<ChartInfo chart={chart} />
			</PanelSection>

			{warnings.length > 0 && (
				<PanelSection title="Warnings">
					<Warnings warnings={warnings} />
					{warnings.some(warning => warning.code === "random-branch") && (
						<button type="button" className="btn btn-xs btn-outline w-full" onClick={reroll}>
							Reroll random branches
						</button>
					)}
				</PanelSection>
			)}

			<PanelSection title="View">
				<div className="space-y-3 rounded-box border border-base-content/10 bg-base-300/40 p-2">
					<div className="join w-full">
						<button
							type="button"
							className={`btn btn-xs join-item flex-1 ${scrollMode === "original" ? "btn-active" : ""}`}
							onClick={() => setScrollMode("original")}
						>
							Original
						</button>
						<button
							type="button"
							className={`btn btn-xs join-item flex-1 ${scrollMode === "noSv" ? "btn-active" : ""}`}
							onClick={() => setScrollMode("noSv")}
						>
							No SV
						</button>
					</div>

					<label className="block space-y-1">
						<span className="text-xs text-base-content/60">Scroll speed</span>
						<input
							type="range"
							className="range range-xs"
							min={SCROLL_SPEED_MIN}
							max={SCROLL_SPEED_MAX}
							step={0.05}
							value={scrollSpeed}
							onChange={e => setScrollSpeed(Number(e.target.value))}
						/>
					</label>
				</div>
			</PanelSection>
		</PanelFrame>
	);
}
