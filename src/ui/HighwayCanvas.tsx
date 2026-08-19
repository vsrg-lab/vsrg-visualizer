import { Application } from "pixi.js";
import { useEffect, useRef } from "react";

import type { Clock } from "../engine/clock";
import type { Chart } from "../model/types";
import { Highway } from "../render/highway";
import { THEMES } from "../theme";

type HighwayCanvasProps = {
	chart: Chart;
	clock: Clock;
	pxPerUnit: number;
};

/** Mounts a Pixi Application for the given chart and drives it from the shared Clock each frame. */
export function HighwayCanvas({ chart, clock, pxPerUnit }: HighwayCanvasProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const clockRef = useRef(clock);
	const pxRef = useRef(pxPerUnit);

	useEffect(() => {
		clockRef.current = clock;
		pxRef.current = pxPerUnit;
	}, [clock, pxPerUnit]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		let app: Application | null = null;
		let highway: Highway | null = null;
		let canceled = false;

		void (async () => {
			const created = new Application();
			await created.init({ background: THEMES.dark.baseBg, resizeTo: host });
			if (canceled) {
				created.destroy(true, { children: true });
				return;
			}

			app = created;
			host.appendChild(app.canvas);
			highway = new Highway(app.stage, chart, {
				laneWidth: 64,
				receptorY: app.screen.height - 90,
				height: app.screen.height
			});

			app.ticker.add(() => highway?.render(clockRef.current.timeMs, pxRef.current));
		})();

		return () => {
			canceled = true;
			if (app) {
				app.destroy(true, { children: true });
				app = null;
			}
			highway = null;
		};
	}, [chart]);

	return <div ref={hostRef} className="w-full h-full" />;
}
