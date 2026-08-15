/** Presentational playback controls; all state lives in the parent. */
export function Transport({
	playing,
	timeMs,
	durationMs,
	rate,
	pxPerUnit,
	onPlayPause,
	onSeek,
	onRate,
	onPxPerUnit
}: {
	playing: boolean;
	timeMs: number;
	durationMs: number;
	rate: number;
	pxPerUnit: number;
	onPlayPause: () => void;
	onSeek: (timeMs: number) => void;
	onRate: (rate: number) => void;
	onPxPerUnit: (pxPerUnit: number) => void;
}) {
	return (
		<div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "8px" }}>
			<button onClick={onPlayPause}>{playing ? "Pause" : "Play"}</button>
			<input
				type="range"
				min={0}
				max={Math.max(durationMs, 1)}
				value={Math.min(timeMs, durationMs)}
				onChange={e => onSeek(Number(e.target.value))}
				style={{ flex: 1 }}
			/>
			<span>{(timeMs / 1000).toFixed(1)}s</span>
			<label>Rate
				<select value={rate} onChange={e => onRate(Number(e.target.value))}>
					<option value={0.5}>0.5x</option>
					<option value={1}>1x</option>
					<option value={1.5}>1.5x</option>
					<option value={2}>2x</option>
				</select>
			</label>
			<label>Speed
				<input
					type="range"
					min={0.05}
					max={1}
					step={0.01}
					value={pxPerUnit}
					onChange={e => onPxPerUnit(Number(e.target.value))}
				/>
			</label>
		</div>
	);
}
