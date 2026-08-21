import { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import type { HighwaySize } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { Highway } from "../../render/highway";
import { clock, usePlaybackStore } from "../../store/playback";
import { useSettingsStore } from "../../store/settings";
import { CANVAS_BG, HIGHWAY_PALETTE } from "../../theme";

/** Wheel travel converts to seek time at this rate; a ~100px notch seeks 0.5s. */
const WHEEL_SEEK_MS_PER_PX = 5;

type HighwayCanvasProps = {
	chart: Chart;
	size: HighwaySize;
	endMs: number;
};

/** Mounts a Pixi Application for the given chart and drives it from the shared Clock each frame. */
export function HighwayCanvas({ chart, size, endMs }: HighwayCanvasProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const highwayRef = useRef<Highway | null>(null);
	const [app, setApp] = useState<Application | null>(null);

	// The Application outlives chart and size changes - rebuilding it would recreate the WebGL
	// context on every resize frame. The ticker reads the current Highway through the ref.
	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		let created: Application | null = null;
		let canceled = false;

		void (async () => {
			const instance = new Application();
			await instance.init({ background: CANVAS_BG, resizeTo: host });
			if (canceled) {
				instance.destroy(true, { children: true });
				return;
			}

			created = instance;
			host.appendChild(instance.canvas);
			instance.ticker.add(() => highwayRef.current?.render(clock.timeMs, useSettingsStore.getState().scrollSpeed));
			setApp(instance);
		})();

		return () => {
			canceled = true;
			setApp(null);
			created?.destroy(true, { children: true });
		};
	}, []);

	useEffect(() => {
		if (!app)
			return;

		// resizeTo only re-reads the host on a window resize, so a host that changed on its own -
		// a folded panel, or a single-stage chart replaced by a double - has to be pulled in here.
		app.resize();

		const highway = new Highway(app.stage, chart, {
			canvasWidth: size.fieldPx,
			laneWidth: size.laneWidth,
			receptorY: size.receptorY,
			height: size.height,
			palette: HIGHWAY_PALETTE
		});
		highwayRef.current = highway;

		return () => {
			highwayRef.current = null;
			highway.destroy();
		};
	}, [app, chart, size]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		const onWheel = (event: WheelEvent) => {
			event.preventDefault();

			const { playing, timeMs, seek, pause } = usePlaybackStore.getState();
			if (playing)
				pause();

			seek(Math.min(Math.max(timeMs + event.deltaY * WHEEL_SEEK_MS_PER_PX, 0), endMs));
		};

		host.addEventListener("wheel", onWheel, { passive: false });
		return () => host.removeEventListener("wheel", onWheel);
	}, [endMs]);

	return <div ref={hostRef} className="h-full shrink-0" style={{ width: size.fieldPx }} />;
}
