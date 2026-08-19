import { useRef } from "react";

import { chartEndMs } from "../../engine/duration";
import { useHighwaySize } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { useSettingsStore } from "../../store/settings";
import { HighwayCanvas } from "../common/HighwayCanvas";
import { LeftPanel } from "../panels/LeftPanel";
import { RightPanel } from "../panels/RightPanel";
import { Transport } from "../transport/Transport";

type AppShellProps = {
	chart: Chart;
};

/**
 * Three-pane frame around the highway. The main row is the layout measuring element:
 * its width spans the side panels, its height is the canvas area.
 */
export function AppShell({ chart }: AppShellProps) {
	const mainRef = useRef<HTMLDivElement>(null);
	const size = useHighwaySize(mainRef, chart);
	const leftPanelOpen = useSettingsStore(state => state.leftPanelOpen);
	const rightPanelOpen = useSettingsStore(state => state.rightPanelOpen);
	const togglePanel = useSettingsStore(state => state.togglePanel);

	return (
		<div className="flex flex-col h-screen bg-base-100 text-base-content font-sans">
			<div ref={mainRef} className="flex flex-1 min-h-0">
				{size?.effectiveLeft && <LeftPanel />}
				{!size?.effectiveRight && !leftPanelOpen && (
					<button
						type="button"
						className="btn btn-ghost btn-xs self-start m-1"
						onClick={() => togglePanel("left")}
						title="Open left panel"
					>
						⟨
					</button>
				)}

				<div className="flex-1 min-h-0 flex justify-center">
					{size && <HighwayCanvas chart={chart} size={size} />}
				</div>

				{size?.effectiveRight && <RightPanel chart={chart} />}
				{!size?.effectiveLeft && !rightPanelOpen && (
					<button
						type="button"
						className="btn btn-ghost btn-xs self-start m-1"
						onClick={() => togglePanel("right")}
						title="Open right panel"
					>
						⟩
					</button>
				)}
			</div>
			<Transport durationMs={chartEndMs(chart)}/>
		</div>
	);
}
