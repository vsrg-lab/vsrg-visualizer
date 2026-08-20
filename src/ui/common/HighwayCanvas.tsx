import { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";

import { chartEndMs } from "../../engine/duration";
import type { HighwaySize } from "../../hooks/useHighwaySize";
import type { Chart } from "../../model/types";
import { Highway } from "../../render/highway";
import { clock, usePlaybackStore } from "../../store/playback";
import { useSettingsStore } from "../../store/settings";
import { resolveTheme, THEMES } from "../../theme";

/** Wheel travel converts to seek time at this rate; a ~100px notch seeks 0.5s. */
const WHEEL_SEEK_MS_PER_PX = 5;

type HighwayCanvasProps = {
	chart: Chart;
	size: HighwaySize;
};

/** Mounts a Pixi Application for the given chart and drives it from the shared Clock each frame. */
export function HighwayCanvas({ chart, size }: HighwayCanvasProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const theme = useSettingsStore(state => state.theme);
	const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => setSystemDark(media.matches);
		media.addEventListener("change", onChange);

		return () => media.removeEventListener("change", onChange);
	}, []);

	const themeEntry = THEMES[resolveTheme(theme, systemDark)];

	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		let app: Application | null = null;
		let highway: Highway | null = null;
		let canceled = false;

		void (async () => {
			const created = new Application();
			await created.init({ background: themeEntry.baseBg, resizeTo: host });
			if (canceled) {
				created.destroy(true, { children: true });
				return;
			}

			app = created;
			host.appendChild(app.canvas);

			const stageGap = chart.layout.stages === 2 ? size.laneWidth / 2 : 0;
			highway = new Highway(app.stage, chart, {
				canvasWidth: size.highwayPx + stageGap,
				laneWidth: size.laneWidth,
				receptorY: size.receptorY,
				height: size.height,
				palette: themeEntry.highway
			});

			app.ticker.add(() => highway?.render(clock.timeMs, useSettingsStore.getState().scrollSpeed));
		})();

		return () => {
			canceled = true;
			if (app) {
				app.destroy(true, { children: true });
				app = null;
			}
			highway = null;
		};
	}, [chart, size, themeEntry]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		const endMs = chartEndMs(chart);
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();

			const { playing, timeMs, seek, pause } = usePlaybackStore.getState();
			if (playing)
				pause();

			seek(Math.min(Math.max(timeMs + event.deltaY * WHEEL_SEEK_MS_PER_PX, 0), endMs));
		};

		host.addEventListener("wheel", onWheel, { passive: false });
		return () => host.removeEventListener("wheel", onWheel);
	}, [chart]);

	const stageGap = chart.layout.stages === 2 ? size.laneWidth / 2 : 0;
	return <div ref={hostRef} className="h-full" style={{ width: size.highwayPx + stageGap }} />;
}
