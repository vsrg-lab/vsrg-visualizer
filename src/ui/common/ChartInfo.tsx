import { currentTiming } from "../../engine/scroll";
import type { Chart } from "../../model/types";
import { usePlaybackStore } from "../../store/playback";

type ChartInfoProps = {
	chart: Chart;
};

/** Chart identity plus the BPM/meter active at the current playback time. */
export function ChartInfo({ chart }: ChartInfoProps) {
	const timeMs = usePlaybackStore(state => state.timeMs);
	const timing = currentTiming(chart.timing, timeMs);

	return (
		<div className="space-y-0.5 rounded-box border border-base-content/10 bg-base-300/40 p-2 text-sm">
			<span className="badge badge-sm badge-ghost">{chart.metadata.original}</span>
			<span className="font-medium">{chart.metadata.title}</span>
			<div className="pt-1 text-base-content/60">{chart.metadata.artist} [{chart.metadata.version}]</div>
			<div className="flex gap-3 pt-1 tabular-nums text-base-content/80">
				<span>{chart.layout.totalKeys}K</span>
				<span>BPM {timing.bpm.toFixed(2)}</span>
			</div>
		</div>
	);
}
