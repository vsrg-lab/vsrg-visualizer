import { currentTiming } from "../engine/scroll";
import type { Chart } from "../model/types";

type ChartInfoProps = {
	chart: Chart;
	timeMs: number;
};

/** Shows chart identity plus the BPM/meter active at the current playback time. */
export function ChartInfo({ chart, timeMs }: ChartInfoProps) {
	const timing = currentTiming(chart.timing, timeMs);

	return (
		<div className="flex items-center gap-4 px-2 py-1 text-sm text-base-content/80">
			<span>{chart.metadata.title} - {chart.metadata.artist} [{chart.metadata.version}]</span>
			<span className="ml-auto tabular-nums">BPM {timing.bpm}</span>
			<span className="tabular-nums">{timing.meter.beats}/{timing.meter.noteValue}</span>
		</div>
	);
}
