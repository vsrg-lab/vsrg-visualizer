import { describe, it, expect } from "vitest";

import { generateBeatLines } from "./beats";
import type { TimingPoint } from "../model/types";

const tp = (timeMs: number, bpm: number, beats: number): TimingPoint => ({
	timeMs,
	bpm,
	meter: { beats, noteValue: 4 },
	multiplier: 1
});

describe("generateBeatLines", () => {
	it("emits one beat per beat-interval, marking downbeats as measures", () => {
		// 120 bpm -> 500ms per beat, 4/4 -> measure every 4 beats
		const lines = generateBeatLines([tp(0, 120, 4)], 2000);
		expect(lines).toEqual([
			{ timeMs: 0, isMeasure: true },
			{ timeMs: 500, isMeasure: false },
			{ timeMs: 1000, isMeasure: false },
			{ timeMs: 1500, isMeasure: false },
			{ timeMs: 2000, isMeasure: true }
		]);
	});

	it("restarts the measure count at each timing point", () => {
		const lines = generateBeatLines([tp(0, 120, 4), tp(1000, 240, 4)], 1500);
		// segment 1: 0(m),500,1000 stops before 1000 boundary; segment 2 starts measure at 1000
		expect(lines.find(l => l.timeMs === 1000)!.isMeasure).toBe(true);
	});
});
