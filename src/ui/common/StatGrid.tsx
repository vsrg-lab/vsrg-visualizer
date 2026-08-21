import { currentTiming } from "../../engine/scroll";
import { npsAt, type ChartStats, type NoteDensity } from "../../engine/stats";
import type { Chart } from "../../model/types";
import { usePlaybackStore } from "../../store/playback";
import { formatCount } from "../format";

type StatCellProps = {
	label: string;
	value: string;
};

function StatCell({ label, value }: StatCellProps) {
	return (
		<div className="bg-surface px-2.5 py-2.25">
			<div className="font-mono text-[10px] tracking-widest text-micro">{label}</div>
			<div className="font-mono text-[16px] tabular-nums text-strong">{value}</div>
		</div>
	);
}

type LiveCellsProps = {
	chart: Chart;
	density: NoteDensity;
};

/**
 * The only two cells that follow the playhead. They are their own component so the rest of the
 * inspector stays off the per-frame render path.
 */
function LiveCells({ chart, density }: LiveCellsProps) {
	const timeMs = usePlaybackStore(state => state.timeMs);

	return (
		<>
			<StatCell label="BPM" value={currentTiming(chart.timing, timeMs).bpm.toFixed(2)} />
			<StatCell label="NPS NOW" value={npsAt(density, timeMs).toFixed(1)} />
		</>
	);
}

type StatGridProps = {
	chart: Chart;
	stats: ChartStats;
	density: NoteDensity;
};

/** Hairline-separated stat cells: two live, two fixed, then two that depend on the chart's shape. */
export function StatGrid({ chart, stats, density }: StatGridProps) {
	const doubles = stats.stageSplit !== null && stats.scratchNotes !== null;
	const [left, right] = stats.stageSplit ?? [0, 0];
	const total = Math.max(1, left + right);

	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line">
			<LiveCells chart={chart} density={density} />
			<StatCell label="NOTES" value={formatCount(stats.notes)} />
			<StatCell label="LN" value={`${stats.lnPercent}%`} />
			{doubles
				? (
					<>
						<StatCell
							label="1P / 2P"
							value={`${Math.round(left / total * 100)} / ${Math.round(right / total * 100)}`}
						/>
						<StatCell label="SCRATCH" value={formatCount(stats.scratchNotes ?? 0)} />
					</>
				)
				: (
					<>
						<StatCell label="NPS PEAK" value={stats.npsPeak.toFixed(1)} />
						<StatCell
							label="SV RANGE"
							value={`${stats.svMin.toFixed(2)}–${stats.svMax.toFixed(2)}`}
						/>
					</>
				)}
		</div>
	);
}
