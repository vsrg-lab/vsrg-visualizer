import { Pause, Play, Square } from "lucide-react";

import { usePlaybackStore } from "../../store/playback";
import { ThemeToggle } from "../shell/ThemeToggle";

/** Elapsed-clock format "m:ss". */
function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const two = (n: number) => String(n).padStart(2, "0");

	return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

type TransportProps = {
	durationMs: number;
	/** Matches the main-row cluster width when measured. */
	width?: number;
};

/** Bottom playback bar. */
export function Transport({ durationMs, width }: TransportProps) {
	const playing = usePlaybackStore(state => state.playing);
	const timeMs = usePlaybackStore(state => state.timeMs);
	const rate = usePlaybackStore(state => state.rate);
	const pause = usePlaybackStore(state => state.pause);
	const play = usePlaybackStore(state => state.play);
	const stop = usePlaybackStore(state => state.stop);
	const seek = usePlaybackStore(state => state.seek);
	const setRate = usePlaybackStore(state => state.setRate);

	return (
		<div
			className="flex flex-col gap-2 px-4 py-2 bg-base-200 border-t border-base-content/10"
			style={width ? { width } : undefined}
		>
			<input
				type="range"
				min={0}
				max={Math.max(durationMs, 1)}
				value={Math.min(timeMs, durationMs)}
				onChange={e => seek(Number(e.target.value))}
				className="range range-xs range-primary w-full"
				title="Seek"
			/>
			<div className="flex flex-wrap items-center justify-center gap-3">
				<div className="flex items-center gap-1">
					<button
						type="button"
						className="btn btn-sm btn-ghost"
						onClick={stop}
						title="Stop (Esc)"
					>
						<Square size={14} />
					</button>
					<button
						type="button"
						className="btn btn-sm btn-circle"
						onClick={playing ? pause : play}
						title={playing ? "Pause (Space)" : "Play (Space)"}
					>
						{playing ? <Pause size={18} /> : <Play size={18} />}
					</button>
				</div>
				<span className="text-sm tabular-nums text-base-content/70">
					{formatClock(timeMs)} / {formatClock(durationMs)}
				</span>
				<label className="flex items-center gap-1 text-sm text-base-content/80">
					Rate
					<select
						className="select select-sm"
						value={rate}
						onChange={e => setRate(Number(e.target.value))}
					>
						<option value={0.5}>0.5x</option>
						<option value={1}>1x</option>
						<option value={1.5}>1.5x</option>
						<option value={2}>2x</option>
					</select>
				</label>
				<ThemeToggle />
			</div>
		</div>
	);
}
