import { describe, it, expect } from "vitest";

import { buildScrollModel, screenY } from "./scroll";
import type { TimingPoint } from "../model/types";

const tp = (timeMs: number, multiplier: number): TimingPoint => ({
	timeMs,
	bpm: 120,
	meter: { beats: 4, noteValue: 4 },
	multiplier
});

describe("buildScrollModel", () => {
	it("maps time to position 1:1 at multiplier 1", () => {
		const m = buildScrollModel([tp(0, 1)]);
		expect(m.positionAt(0)).toBe(0);
		expect(m.positionAt(500)).toBe(500);
	});

	it("accumulates position across SV segments", () => {
		const m = buildScrollModel([tp(0, 1), tp(1000, 2)]);
		expect(m.positionAt(500)).toBe(500);
		expect(m.positionAt(1000)).toBe(1000);
		expect(m.positionAt(1500)).toBe(2000);
	});
});

describe("screenY", () => {
	it("places a note at the receptor when its position equals the playhead", () => {
		expect(screenY(1000, 1000, 2, 800)).toBe(800);
	});

	it("places a future note above the receptor (smaller y) in down-scroll", () => {
		expect(screenY(1100, 1000, 2, 800)).toBe(800 - 200);
	});
});
