import { usePlaybackStore } from "../../store/playback";
import { useSettingsStore } from "../../store/settings";
import { ThemeToggle } from "../shell/ThemeToggle";

type TransportProps = {
	durationMs: number;
};

/** Bottom playback bar. */
export function Transport({ durationMs }: TransportProps) {
	const playing = usePlaybackStore(state => state.playing);
	const timeMs = usePlaybackStore(state => state.timeMs);
	const rate = usePlaybackStore(state => state.rate);
	const pause = usePlaybackStore(state => state.pause);
	const play = usePlaybackStore(state => state.play);
	const stop = usePlaybackStore(state => state.stop);
	const seek = usePlaybackStore(state => state.seek);
	const setRate = usePlaybackStore(state => state.setRate);
	const scrollSpeed = useSettingsStore(state => state.scrollSpeed);

	return (
		<div className="flex items-center gap-3 p-2 bg-base-200">
			<button className="btn btn-sm" onClick={playing ? pause : play}>{playing ? "Pause" : "Play"}</button>
			<button className="btn btn-sm btn-ghost" onClick={stop}>Stop</button>
			<input
				type="range"
				min={0}
				max={Math.max(durationMs, 1)}
				value={Math.min(timeMs, durationMs)}
				onChange={e => seek(Number(e.target.value))}
				className="range range-sm flex-1"
			/>
			<span className="text-sm tabular-nums text-base-content/70">{(timeMs / 1000).toFixed(1)}s</span>
			<label className="flex items-center gap-1 text-sm">
				Rate
				<select className="select select-sm" value={rate} onChange={e => setRate(Number(e.target.value))}>
					<option value={0.5}>0.5x</option>
					<option value={1}>1x</option>
					<option value={1.5}>1.5x</option>
					<option value={2}>2x</option>
				</select>
			</label>
			<span className="text-sm tabular-nums text-base-content/70" title="Scroll speed">
				Speed {scrollSpeed.toFixed(2)}
			</span>
			<ThemeToggle />
		</div>
	);
}
