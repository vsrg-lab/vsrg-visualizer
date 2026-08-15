import { useEffect, useMemo, useRef, useState } from "react";

import { Clock } from "./engine/clock";
import { chartEndMs } from "./engine/duration";
import type { Chart } from "./model/types";
import { ChartInfo } from "./ui/ChartInfo";
import { FileDrop } from "./ui/FileDrop";
import { HighwayCanvas } from "./ui/HighwayCanvas";
import { Transport } from "./ui/Transport";

const PX_PER_UNIT = 0.4;

function now(): number {
	return performance.now();
}

/** App: owns chart/playback state and wires FileDrop, ChartInfo, Transport, and HighwayCanvas together. */
export function App() {
	const [chart, setChart] = useState<Chart | null>(null);
	const [playing, setPlaying] = useState<boolean>(false);
	const [timeMs, setTimeMs] = useState<number>(0);
	const [rate, setRate] = useState<number>(1);

	const clock = useMemo(() => new Clock(now), []);
	const rafRef = useRef<number>(0);

	useEffect(() => {
		const tick = () => {
			if (chart) {
				const end = chartEndMs(chart);
				if (clock.playing && clock.timeMs >= end) {
					clock.pause();
					clock.seek(end);
					setPlaying(false);
				}
			}

			setTimeMs(clock.timeMs);
			rafRef.current = requestAnimationFrame(tick);
		};

		rafRef.current = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafRef.current);
	}, [chart, clock]);

	const duration = chart ? chartEndMs(chart) : 0;

	return (
		<div className="flex flex-col h-screen bg-base-100 text-base-content font-sans">
			<div className="p-2">
				<FileDrop onChart={c => {
					setChart(c);
					clock.seek(0);
					setPlaying(false);
				}} />
			</div>
			{chart && (
				<>
					<ChartInfo chart={chart} timeMs={timeMs} />
					<Transport
						playing={playing}
						timeMs={timeMs}
						durationMs={duration}
						rate={rate}
						onPlayPause={() => {
							if (playing)
								clock.pause();
							else
								clock.play();
							setPlaying(!playing);
						}}
						onStop={() => {
							clock.pause();
							clock.seek(0);
							setPlaying(false);
						}}
						onSeek={ms => clock.seek(ms)}
						onRate={r => {
							clock.setRate(r);
							setRate(r);
						}}
					/>
					<div className="flex-1 min-h-0">
						<HighwayCanvas chart={chart} clock={clock} pxPerUnit={PX_PER_UNIT} />
					</div>
				</>
			)}
		</div>
	);
}
