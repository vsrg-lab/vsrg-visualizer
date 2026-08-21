import { useRef } from "react";

import { AppHeader } from "./AppHeader";
import type { ChartStats, ChartTimingEvent, DifficultySummary, NoteDensity } from "../../engine/stats";
import { FIELD_GUTTER_PX, MINIMAP_GAP_PX, useHighwaySize } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { useChartStore } from "../../store/chart";
import { DensityMinimap } from "../common/DensityMinimap";
import { HighwayCanvas } from "../common/HighwayCanvas";
import { LeftPanel } from "../panels/LeftPanel";
import { RightPanel } from "../panels/RightPanel";
import { Transport } from "../transport/Transport";

type AppShellProps = {
	chart: Chart;
	endMs: number;
	density: NoteDensity;
	stats: ChartStats;
	events: ChartTimingEvent[];
	summaries: DifficultySummary[];
	onOpenHelp: () => void;
};

/**
 * Header / body / footer frame. The body row is the layout measuring element: its width spans
 * the rails, its height is the canvas area. The center slot is reserved at a constant width so
 * loading another chart never moves the rails or reflows the footer.
 */
export function AppShell({ chart, endMs, density, stats, events, summaries, onOpenHelp }: AppShellProps) {
	const mainRef = useRef<HTMLDivElement>(null);
	const size = useHighwaySize(mainRef, chart);

	const format = useChartStore(state => state.set?.sourceFormat ?? null);
	const fileName = useChartStore(state => state.source?.fileName ?? "");

	return (
		<div className="flex h-screen flex-col bg-base-100 font-sans text-body">
			<AppHeader format={format} fileName={fileName} onOpenHelp={onOpenHelp} />

			<div ref={mainRef} className="flex min-h-0 flex-1">
				{size?.effectiveLeft && <LeftPanel summaries={summaries} events={events} />}

				<div
					className="flex min-w-0 flex-1 items-stretch justify-center"
					style={{ gap: MINIMAP_GAP_PX, paddingInline: FIELD_GUTTER_PX }}
				>
					{size && <HighwayCanvas chart={chart} size={size} endMs={endMs} />}
					{size?.effectiveMinimap && <DensityMinimap density={density} endMs={endMs} />}
				</div>

				{size?.effectiveRight && (
					<RightPanel chart={chart} stats={stats} density={density} durationMs={endMs} />
				)}
			</div>

			<Transport durationMs={endMs} events={events} />
		</div>
	);
}
