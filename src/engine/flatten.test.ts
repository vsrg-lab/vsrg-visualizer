import { describe, expect, it } from "vitest";

import { flattenScroll } from "./flatten";
import type { Chart } from "../model/types";

const meter = { beats: 4, noteValue: 4 };

function chart(over: Partial<Chart>): Chart {
	return {
		metadata: { original: "test", title: "T", artist: "A", creator: "C", version: "V" },
		layout: { totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 },
		timing: [{ timeMs: 0, bpm: 120, meter, multiplier: 1 }],
		beatLines: [],
		notes: [],
		scroll: { bpmAffectsScroll: true, baseBpm: 120 },
		...over
	};
}

describe("flattenScroll", () => {
	it("returns the chart untouched in original mode", () => {
		const input = chart({});
		expect(flattenScroll(input, "original")).toBe(input);
	});

	it("rebuilds the multiplier from bpm alone in noSv mode", () => {
		const input = chart({
			timing: [
				{ timeMs: 0, bpm: 120, meter, multiplier: 2 },
				{ timeMs: 1000, bpm: 180, meter, multiplier: 3 }
			]
		});

		expect(flattenScroll(input, "noSv").timing.map(p => p.multiplier)).toEqual([1, 1.5]);
	});

	it("flattens every multiplier to 1 when bpm does not affect scroll", () => {
		const input = chart({
			timing: [
				{ timeMs: 0, bpm: 120, meter, multiplier: 2 },
				{ timeMs: 1000, bpm: 180, meter, multiplier: 0 }
			],
			scroll: { bpmAffectsScroll: false, baseBpm: 120 }
		});

		expect(flattenScroll(input, "noSv").timing.map(p => p.multiplier)).toEqual([1, 1]);
	});

	it("removes a stop's zero-multiplier span while keeping its timestamps", () => {
		const input = chart({
			timing: [
				{ timeMs: 0, bpm: 120, meter, multiplier: 1 },
				{ timeMs: 1000, bpm: 120, meter, multiplier: 0 },
				{ timeMs: 1300, bpm: 120, meter, multiplier: 1 }
			]
		});
		const flat = flattenScroll(input, "noSv");

		expect(flat.timing.map(p => p.multiplier)).toEqual([1, 1, 1]);
		expect(flat.timing.map(p => p.timeMs)).toEqual([0, 1000, 1300]);
	});

	it("leaves timeMs, bpm, meter and notes alone", () => {
		const input = chart({
			timing: [{ timeMs: 0, bpm: 150, meter: { beats: 3, noteValue: 4 }, multiplier: 4 }],
			notes: [{ kind: "tap", timeMs: 42, lane: 1 }]
		});
		const flat = flattenScroll(input, "noSv");

		expect(flat.timing[0].bpm).toBe(150);
		expect(flat.timing[0].meter).toEqual({ beats: 3, noteValue: 4 });
		expect(flat.notes).toBe(input.notes);
	});
});
