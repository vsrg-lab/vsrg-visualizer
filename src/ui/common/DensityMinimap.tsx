import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { npsBars, type NoteDensity } from "../../engine/stats";
import { MINIMAP_PX, RECEPTOR_OFFSET_PX } from "../../hooks/useHighwaySize";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";
import { usePlaybackStore } from "../../store/playback";
import { MINIMAP_PALETTE } from "../../theme";

/** Height of one density bar. */
const BAR_PX = 3;

type DensityMinimapProps = {
	density: NoteDensity;
	endMs: number;
};

/**
 * Note density beside the field, time running bottom to top like the scroll. Bars are rebuilt on
 * resize and the canvas is repainted only when the playhead crosses into another bar.
 */
export function DensityMinimap({ density, endMs }: DensityMinimapProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [box, setBox] = useState<{ width: number; height: number } | null>(null);
	const theme = useResolvedTheme();

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas)
			return;

		const observer = new ResizeObserver(entries => {
			const rect = entries[entries.length - 1].contentRect;
			setBox({ width: rect.width, height: rect.height });
		});
		observer.observe(canvas);

		return () => observer.disconnect();
	}, []);

	const bars = useMemo(
		() => npsBars(density, endMs, box ? Math.max(1, Math.floor(box.height / BAR_PX)) : 0),
		[density, endMs, box]
	);

	// Quantized on purpose: a per-frame subscription here would repaint the canvas 60 times a second
	// for a playhead that only ever moves in whole bars.
	const playedBars = usePlaybackStore(state => endMs > 0
		? Math.min(bars.length, Math.max(0, Math.round(state.timeMs / endMs * bars.length)))
		: 0);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !box || box.width === 0 || box.height === 0)
			return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(box.width * dpr);
		canvas.height = Math.round(box.height * dpr);

		const g = canvas.getContext("2d");
		if (!g)
			return;

		const palette = MINIMAP_PALETTE[theme];
		const barHeight = box.height / bars.length;
		let peak = 0;
		for (const value of bars)
			peak = Math.max(peak, value);

		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, box.width, box.height);

		for (let i = 0; i < bars.length; i++) {
			const length = peak > 0 ? bars[i] / peak * box.width : 0;
			if (length <= 0)
				continue;

			g.fillStyle = i < playedBars ? palette.played : palette.unplayed;
			g.fillRect(0, box.height - (i + 1) * barHeight, Math.max(1, length), Math.max(1, barHeight - 1));
		}

		g.fillStyle = palette.playhead;
		g.fillRect(0, box.height - playedBars * barHeight, box.width, 1);
	}, [bars, box, playedBars, theme]);

	function seekTo(event: PointerEvent<HTMLCanvasElement>): void {
		const rect = event.currentTarget.getBoundingClientRect();
		if (rect.height === 0)
			return;

		const fraction = 1 - (event.clientY - rect.top) / rect.height;
		const { playing, pause, seek } = usePlaybackStore.getState();
		if (playing)
			pause();

		seek(Math.min(Math.max(fraction, 0), 1) * endMs);
	}

	return (
		<div
			className="flex shrink-0 flex-col gap-1.5 pt-2.5"
			style={{ width: MINIMAP_PX, paddingBottom: RECEPTOR_OFFSET_PX }}
		>
			<span className="font-mono text-[10px] tracking-widest text-micro [writing-mode:vertical-rl]">
				NPS
			</span>
			<canvas
				ref={canvasRef}
				className="block w-full flex-1 cursor-pointer"
				onPointerDown={event => {
					event.currentTarget.setPointerCapture(event.pointerId);
					seekTo(event);
				}}
				onPointerMove={event => {
					if (event.buttons & 1)
						seekTo(event);
				}}
			/>
		</div>
	);
}
