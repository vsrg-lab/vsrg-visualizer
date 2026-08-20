import { create } from "zustand";

import { Clock } from "../engine/clock";

/** Shared playback clock - module-owned so stores and the rAF loop see one timeline. */
export const clock = new Clock(() => performance.now());

type PlaybackState = {
	playing: boolean;
	timeMs: number;
	rate: number;

	play: () => void;
	pause: () => void;
	stop: () => void;
	seek: (ms: number) => void;
	setRate: (rate: number) => void;
	/** Called by the rAF loop - mirrors the clock time into state. */
	tick: () => void;
};

/** Playback state - updated every frame, so it is not persisted. */
export const usePlaybackStore = create<PlaybackState>()(set => ({
	playing: false,
	timeMs: 0,
	rate: 1,
	play: () => {
		clock.play();
		set({ playing: clock.playing });
	},
	pause: () => {
		clock.pause();
		set({ playing: clock.playing });
	},
	stop: () => {
		clock.pause();
		clock.seek(0);
		set({ playing: false, timeMs: 0 });
	},
	seek: ms => {
		clock.seek(Math.max(0, ms));
		set({ timeMs: clock.timeMs });
	},
	setRate: rate => {
		clock.setRate(rate);
		set({ rate: clock.rate, timeMs: clock.timeMs });
	},
	tick: () => set({ timeMs: clock.timeMs })
}));
