import { useEffect, useMemo, useRef, useState } from "react";

import { Clock } from "./engine/clock";
import { chartEndMs } from "./engine/duration";
import { flattenScroll, type ScrollMode } from "./engine/flatten";
import type { ChartSet, ParseError } from "./model/types";
import { loadChart } from "./parser";
import { ChartInfo } from "./ui/ChartInfo";
import { ChartSelect } from "./ui/ChartSelect";
import { FileDrop } from "./ui/FileDrop";
import { HighwayCanvas } from "./ui/HighwayCanvas";
import { Transport } from "./ui/Transport";
import { Warnings } from "./ui/Warnings";

const PX_PER_UNIT = 0.4;

function now(): number {
	return performance.now();
}

/** App: owns chart/playback state and wires the loader, panels and highway together. */
export function App() {
	const [set, setSet] = useState<ChartSet | null>(null);
	const [errors, setErrors] = useState<ParseError[]>([]);
	const [file, setFile] = useState<{ bytes: ArrayBuffer, fileName: string } | null>(null);
	const [selected, setSelected] = useState<number>(0);
	const [scrollMode, setScrollMode] = useState<ScrollMode>("original");
	const [playing, setPlaying] = useState<boolean>(false);
	const [timeMs, setTimeMs] = useState<number>(0);
	const [rate, setRate] = useState<number>(1);

	const clock = useMemo(() => new Clock(now), []);
	const rafRef = useRef<number>(0);

	const chart = useMemo(
		() => set ? flattenScroll(set.charts[selected], scrollMode) : null,
		[set, selected, scrollMode]
	);

	function load(bytes: ArrayBuffer, fileName: string): void {
		const result = loadChart(bytes, fileName);

		clock.pause();
		clock.seek(0);
		setPlaying(false);

		if (result.ok) {
			setErrors([]);
			setSet(result.set);
			setSelected(0);
			return;
		}

		setSet(null);
		setErrors(result.errors);
	}

	async function handleFile(file: File): Promise<void> {
		const bytes = await file.arrayBuffer();
		setFile({ bytes, fileName: file.name });
		load(bytes, file.name);
	}

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
				<FileDrop onFile={f => void handleFile(f)} />
				{errors.length > 0 && (
					<ul className="text-error text-sm mt-2">
						{errors.map((e, i) => <li key={i}>line {e.line}: {e.message}</li>)}
					</ul>
				)}
			</div>
			{set && chart && (
				<>
					<div className="flex flex-wrap items-center gap-2 px-2">
						<ChartSelect charts={set.charts} selected={selected} onSelect={setSelected} />
						<Warnings warnings={set.warnings} />
						{set.warnings.some(warning => warning.code === "random-branch") && (
							<button
								type="button"
								className="btn btn-xs btn-outline"
								onClick={() => {
									if (file)
										load(file.bytes, file.fileName);
								}}
							>
								Reroll random brancehs
							</button>
						)}
					</div>

					<ChartInfo chart={chart} timeMs={timeMs} />
					<Transport
						playing={playing}
						timeMs={timeMs}
						durationMs={duration}
						rate={rate}
						scrollMode={scrollMode}
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
						onScrollMode={setScrollMode}
					/>
					<div className="flex-1 min-h-0">
						<HighwayCanvas chart={chart} clock={clock} pxPerUnit={PX_PER_UNIT} />
					</div>
				</>
			)}
		</div>
	);
}
