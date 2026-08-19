import { beforeEach, describe, expect, it } from "vitest";

import { usePlaybackStore } from "./playback";

const state = () => usePlaybackStore.getState();

beforeEach(() => {
	state().setRate(1);
	state().stop();
});

describe("playback store", () => {
	it("starts paused at zero", () => {
		expect(state().playing).toBe(false);
		expect(state().timeMs).toBe(0);
		expect(state().rate).toBe(1);
	});

	it("plays and pauses", () => {
		state().play();
		expect(state().playing).toBe(true);
		state().pause();
		expect(state().playing).toBe(false);
	});

	it("seeks to a time and reflects it in state", () => {
		state().seek(1500);
		expect(state().timeMs).toBe(1500);
	});

	it("seeks by a delta and clamps below zero", () => {
		state().seek(1000);
		state().seekBy(500);
		expect(state().timeMs).toBe(1500);
		state().seekBy(-2000);
		expect(state().timeMs).toBe(0);
	});

	it("stops back at zero even while playing", () => {
		state().seek(2000);
		state().play();
		state().stop();
		expect(state().playing).toBe(false);
		expect(state().timeMs).toBe(0);
	});

	it("changes the rate", () => {
		state().setRate(2);
		expect(state().rate).toBe(2);
	});

	it("tick mirrors the clock time", () => {
		state().seek(1200);
		state().tick();
		expect(state().timeMs).toBe(1200);
	});
});
