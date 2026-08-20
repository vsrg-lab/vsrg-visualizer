import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { chartEndMs } from "../../engine/duration";
import { useHighwaySize } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { useSettingsStore } from "../../store/settings";
import { HighwayCanvas } from "../common/HighwayCanvas";
import { LeftPanel } from "../panels/LeftPanel";
import { RightPanel } from "../panels/RightPanel";
import { Transport } from "../transport/Transport";

/** Cap for the whole app block. */
const APP_MAX_PX = 1920;

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
		<div className="flex h-screen justify-center bg-base-100 px-3 py-8 text-base-content font-sans">
			<div className="flex h-full w-full flex-col" style={{ maxWidth: APP_MAX_PX }}>
				<div ref={mainRef} className="flex w-full flex-1 min-h-0 gap-3">
					{!size?.effectiveLeft && !leftPanelOpen && (
						<button
							type="button"
							className="btn btn-ghost btn-xs self-center m-1 shrink-0"
							onClick={() => togglePanel("left")}
							title="Open left panel"
						>
							<ChevronLeft size={14} />
						</button>
					)}
					{size?.effectiveLeft && <LeftPanel />}

					<div className="flex min-h-0 flex-1 justify-center">
						{size && <HighwayCanvas chart={chart} size={size} />}
					</div>

					{size?.effectiveRight && <RightPanel chart={chart} />}
					{!size?.effectiveLeft && !rightPanelOpen && (
						<button
							type="button"
							className="btn btn-ghost btn-xs self-center m-1 shrink-0"
							onClick={() => togglePanel("right")}
							title="Open right panel"
						>
							<ChevronRight size={14} />
						</button>
					)}
				</div>
				<Transport durationMs={chartEndMs(chart)} />
			</div>
		</div>
	);
}
