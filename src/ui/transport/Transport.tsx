import { Pause, Play, Square } from "lucide-react";
import { memo, useMemo } from "react";

import type { ChartTimingEvent } from "../../engine/stats";
import { usePlaybackStore } from "../../store/playback";
import { IconButton } from "../common/IconButton";
import { Segmented } from "../common/Segmented";
import { formatClock, formatClockCentis } from "../format";

const RATES: { value: number; label: string }[] = [
	{ value: 0.5, label: "0.5" },
	{ value: 1, label: "1.0" },
	{ value: 1.5, label: "1.5" },
	{ value: 2, label: "2.0" }
];

/** Flags closer together than this share one label; below it they would just overprint. */
const FLAG_MERGE_PERCENT = 3;

/** One label on the flag lane, possibly standing for several events at the same spot. */
type Flag = { percent: number; text: string; warn: boolean };

function flagText(event: ChartTimingEvent): string {
	if (event.kind === "bpm")
		return String(Math.round(event.value));
	if (event.kind === "sv")
		return `×${event.value.toFixed(1)}`;

	return "STOP";
}

/** Places one label per event, then merges runs that would overlap into a counted label. */
function buildFlags(events: ChartTimingEvent[], durationMs: number): Flag[] {
	if (durationMs <= 0)
		return [];

	const flags: Flag[] = [];
	let runStart = 0;

	const flush = (from: number, to: number): void => {
		const first = events[from];
		const count = to - from;
		const sameKind = events.slice(from, to).every(event => event.kind === first.kind);

		flags.push({
			percent: first.timeMs / durationMs * 100,
			text: count > 1 && sameKind ? `${flagText(first)} ×${count}` : flagText(first),
			warn: events.slice(from, to).some(event => event.kind === "stop")
		});
	};

	for (let i = 1; i <= events.length; i++) {
		const gap = i < events.length
			? (events[i].timeMs - events[runStart].timeMs) / durationMs * 100
			: Infinity;

		if (gap >= FLAG_MERGE_PERCENT) {
			flush(runStart, i);
			runStart = i;
		}
	}

	return flags;
}

type FlagLaneProps = {
	flags: Flag[];
};

/**
 * Memoized because the bar around it re-renders every frame off the clock, while the flags only
 * change when the chart does.
 */
const FlagLane = memo(function FlagLane({ flags }: FlagLaneProps) {
	return (
		<div className="relative h-3">
			{flags.map((flag, i) => (
				<span
					key={i}
					className={`absolute font-mono text-[10px] tabular-nums ${
						flag.warn ? "text-warn-ui" : "text-micro"
					}`}
					style={{ left: `${flag.percent}%` }}
				>
					{flag.text}
				</span>
			))}
		</div>
	);
});

type TransportProps = {
	durationMs: number;
	events: ChartTimingEvent[];
};

/** Bottom playback bar: transport, clock, seek surface and rate, in one row. */
export function Transport({ durationMs, events }: TransportProps) {
	const playing = usePlaybackStore(state => state.playing);
	const timeMs = usePlaybackStore(state => state.timeMs);
	const rate = usePlaybackStore(state => state.rate);
	const pause = usePlaybackStore(state => state.pause);
	const play = usePlaybackStore(state => state.play);
	const stop = usePlaybackStore(state => state.stop);
	const seek = usePlaybackStore(state => state.seek);
	const setRate = usePlaybackStore(state => state.setRate);

	const flags = useMemo(() => buildFlags(events, durationMs), [events, durationMs]);
	const progress = durationMs > 0 ? Math.min(timeMs, durationMs) / durationMs * 100 : 0;

	return (
		<div className="flex h-17 shrink-0 items-center gap-4.5 border-t border-line bg-surface px-4.5">
			<div className="flex items-center gap-1.5">
				<IconButton label="Stop (Esc)" size={30} onClick={stop}>
					<Square size={13} fill="currentColor" strokeWidth={0} />
				</IconButton>
				<button
					type="button"
					title={playing ? "Pause (Space)" : "Play (Space)"}
					aria-label={playing ? "Pause" : "Play"}
					className="flex size-9.5 shrink-0 items-center justify-center rounded-full bg-strong text-on-strong"
					onClick={playing ? pause : play}
				>
					{playing
						? <Pause size={16} fill="currentColor" strokeWidth={0} />
						: <Play size={16} fill="currentColor" strokeWidth={0} />}
				</button>
			</div>

			<div className="flex w-32.5 shrink-0 items-baseline gap-1.5">
				<span className="font-mono text-[20px] tabular-nums text-strong">{formatClockCentis(timeMs)}</span>
				<span className="font-mono text-[12px] tabular-nums text-micro">{formatClock(durationMs)}</span>
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-1.25">
				<div className="relative flex h-2 items-center">
					<div className="absolute inset-x-0 h-0.5 rounded-sm bg-base-300" />
					<div
						className="absolute left-0 h-0.5 rounded-sm bg-accent-ui"
						style={{ width: `${progress}%` }}
					/>
					<div
						className="absolute -ml-1.25 size-2.5 rounded-full bg-strong"
						style={{ left: `${progress}%` }}
					/>
					<input
						type="range"
						title="Seek"
						aria-label="Seek"
						min={0}
						max={Math.max(durationMs, 1)}
						value={Math.min(timeMs, durationMs)}
						onChange={e => seek(Number(e.target.value))}
						className="absolute inset-0 size-full cursor-pointer opacity-0"
					/>
				</div>
				<FlagLane flags={flags} />
			</div>

			<Segmented
				label="Playback rate"
				variant="compact"
				options={RATES}
				value={rate}
				onChange={setRate}
			/>
		</div>
	);
}
