import { currentTiming } from "../../engine/scroll";
import type { Chart } from "../../model/types";
import { usePlaybackStore } from "../../store/playback";

type ChartInfoProps = {
	chart: Chart;
};

/** Shows chart identity plus the BPM/meter active at the current playback time. */
export function ChartInfo({ chart }: ChartInfoProps) {
	const timeMs = usePlaybackStore(state => state.timeMs);
	const timing = currentTiming(chart.timing, timeMs);

	return (
		<div className="flex flex-col items-start gap-0.5 text-sm text-base-content/80">
			<span className="badge badge-sm badge-ghost">{chart.metadata.original}</span>
			<span className="font-medium">{chart.metadata.title}</span>
			<span className="text-base-content/60">{chart.metadata.artist} [{chart.metadata.version}]</span>
			<div className="flex gap-3 tabular-nums">
				<span>{chart.layout.totalKeys}K</span>
				<span>BPM {timing.bpm}</span>
			</div>
		</div>
	);
}
