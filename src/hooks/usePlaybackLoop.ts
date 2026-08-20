import { useEffect, useRef } from "react";

import { clock, usePlaybackStore } from "../store/playback";

/**
 * rAF loop that calls the playback store tick() and stops at the song end.
 * While the clock is paused nothing is mirrored - the store already holds the paused time.
 * endMs is null when no chart is loaded, which stops the loop entirely.
 */
export function usePlaybackLoop(endMs: number | null): void {
	const rafRef = useRef<number>(0);

	useEffect(() => {
		if (endMs === null)
			return;

		const loop = () => {
			if (clock.playing) {
				usePlaybackStore.getState().tick();

				const { timeMs, seek, pause } = usePlaybackStore.getState();
				if (timeMs >= endMs) {
					seek(endMs);
					pause();
				}
			}

			rafRef.current = requestAnimationFrame(loop);
		};

		rafRef.current = requestAnimationFrame(loop);

		return () => cancelAnimationFrame(rafRef.current);
	}, [endMs]);
}
