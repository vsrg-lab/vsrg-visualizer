import { useEffect, useRef } from "react";

import { chartEndMs } from "../engine/duration";
import type { Chart } from "../model/types";
import { usePlaybackStore } from "../store/playback";

/**
 * rAF loop that calls the playback store tick() and stops at the song end.
 * The chart end is derived from the current chart - null means no playback.
 */
export function usePlaybackLoop(chart: Chart | null): void {
	const rafRef = useRef<number>(0);

	useEffect(() => {
		if (!chart)
			return;

		const endMs = chartEndMs(chart);
		const loop = () => {
			usePlaybackStore.getState().tick();

			const { playing, timeMs, seek, pause } = usePlaybackStore.getState();
			if (playing && timeMs >= endMs) {
				seek(endMs);
				pause();
			}

			rafRef.current = requestAnimationFrame(loop);
		};

		rafRef.current = requestAnimationFrame(loop);

		return () => cancelAnimationFrame(rafRef.current);
	}, [chart]);
}
