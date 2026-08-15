import { useEffect, useMemo, useRef, useState } from "react";

import { Clock } from "./engine/clock";
import type { Chart } from "./model/types";
import { FileDrop } from "./ui/FileDrop";
import { HighwayCanvas } from "./ui/HighwayCanvas";
import { Transport } from "./ui/Transport";

function chartDuration(chart: Chart): number {
	let end = 0;
	for (const n of chart.notes)
		end = Math.max(end, n.kind === "hold" ? n.endMs : n.timeMs);

	return end;
}

function now(): number {
	return performance.now();
}

/** App: owns chart/playback state and wires FileDrop, Transport, and HIghwayCanvas together. */
export function App() {
	const [chart, setChart] = useState<Chart | null>(null);
	const [pxPerUnit, setPxPerUnit] = useState<number>(0.4);
	const [playing, setPlaying] = useState<boolean>(false);
	const [timeMs, setTimeMs] = useState<number>(0);
	const [rate, setRate] = useState<number>(1);

	const clock = useMemo(() => new Clock(now), []);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const tick = () => {
			setTimeMs(clock.timeMs);
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafRef.current);
	}, [clock]);

	const duration = chart ? chartDuration(chart) + 2000 : 0;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh", color: "#ddd", fontFamily: "sans-serif" }}>
			<div style={{ padding: "8px" }}>
				<FileDrop onChart={c => {
					setChart(c);
					clock.seek(0);
					setPlaying(false);
				}} />
			</div>
			{chart && (
				<>
					<div style={{ padding: "4px 8px" }}>
						{chart.metadata.title} - {chart.metadata.artist} [{chart.metadata.version}]
					</div>
					<Transport
						playing={playing}
						timeMs={timeMs}
						durationMs={duration}
						rate={rate}
						pxPerUnit={pxPerUnit}
						onPlayPause={() => {
							if (playing)
								clock.pause();
							else
								clock.play();
							setPlaying(!playing);
						}}
						onSeek={ms => clock.seek(ms)}
						onRate={r => {
							clock.setRate(r);
							setRate(r);
						}}
						onPxPerUnit={setPxPerUnit}
					/>
					<div style={{ flex: 1, minHeight: 0 }}>
						<HighwayCanvas chart={chart} clock={clock} pxPerUnit={pxPerUnit} />
					</div>
				</>
			)}
		</div>
	);
}
