type TransportProps = {
	playing: boolean;
	timeMs: number;
	durationMs: number;
	rate: number;

	onPlayPause: () => void;
	onStop: () => void;
	onSeek: (timeMs: number) => void;
	onRate: (rate: number) => void;
};

/** Presentational playback controls; all state lives in the parent. */
export function Transport({ playing, timeMs, durationMs, rate, onPlayPause, onStop, onSeek, onRate }: TransportProps) {
	return (
		<div className="flex items-center gap-3 p-2 bg-base-200">
			<button className="btn btn-sm" onClick={onPlayPause}>{playing ? "Pause" : "Play"}</button>
			<button className="btn btn-sm btn-ghost" onClick={onStop}>Stop</button>
			<input
				type="range"
				min={0}
				max={Math.max(durationMs, 1)}
				value={Math.min(timeMs, durationMs)}
				onChange={e => onSeek(Number(e.target.value))}
				className="range range-sm flex-1"
			/>
			<span className="text-sm tabular-nums text-base-content/70">{(timeMs / 1000).toFixed(1)}s</span>
			<label className="flex items-center gap-1 text-sm">
				Rate
				<select className="select select-sm" value={rate} onChange={e => onRate(Number(e.target.value))}>
					<option value={0.5}>0.5x</option>
					<option value={1}>1x</option>
					<option value={1.5}>1.5x</option>
					<option value={2}>2x</option>
				</select>
			</label>
		</div>
	);
}
