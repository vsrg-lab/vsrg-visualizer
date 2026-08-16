import { describe, expect, it } from "vitest";

import { chartEndMs } from "./duration";
import type { Chart, Note } from "../model/types";

const baseChart = (notes: Note[]): Chart => ({
	metadata: { original: "x", title: "x", artist: "x", creator: "x", version: "x" },
	layout: { totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 },
	timing: [{ timeMs: 0, bpm: 120, meter: { beats: 4, noteValue: 4 }, multiplier: 1 }],
	scroll: { bpmAffectsScroll: false, baseBpm: 120 },
	notes
});

describe("chartEndMs", () => {
	it("adds 5000ms padding after the last tap note", () => {
		const chart = baseChart([{ kind: "tap", timeMs: 1000, lane: 0 }]);
		expect(chartEndMs(chart)).toBe(6000);
	});

	it("uses a hold's endMs, not its startMs, when the hold is last", () => {
		const chart = baseChart([
			{ kind: "tap", timeMs: 1000, lane: 0 },
			{ kind: "hold", lane: 1, startMs: 1200, endMs: 3000 }
		]);
		expect(chartEndMs(chart)).toBe(8000);
	});

	it("returns just the padding when there are no notes", () => {
		expect(chartEndMs(baseChart([]))).toBe(5000);
	});
});
