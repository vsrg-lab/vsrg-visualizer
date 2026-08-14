import { describe, expect, it } from "vitest";

import { parseTiming } from "./timing";

const lines = (...t: string[]) => t.map((text, i) => ({ lineNo: i + 1, text }));

describe("parseTiming", () => {
	it("parses points and defaults multiplier to 1.0", () => {
		const r = parseTiming(lines("0, 120.0, 4/4", "1000, 150, 3/4, 1.5"));

		expect(r.errors).toEqual([]);
		expect(r.value).toEqual([
			{ timeMs: 0, bpm: 120, meter: { beats: 4, noteValue: 4 }, multiplier: 1 },
			{ timeMs: 1000, bpm: 150, meter: { beats: 3, noteValue: 4 }, multiplier: 1.5 }
		]);
	});

	it("errors when the first point is not at 0", () => {
		const r = parseTiming(lines("100, 120, 4/4"));

		expect(r.value).toBeNull();
		expect(r.errors.some(e => /first.*0/i.test(e.message))).toBe(true);
	});

	it("errors on non-ascending timestamps", () => {
		const r = parseTiming(lines("0, 120, 4/4", "500, 120, 4/4", "400, 120, 4/4"));

		expect(r.errors.some(e => /ascending/i.test(e.message))).toBe(true);
	});

	it("errors on non-positive bpm", () => {
		const r = parseTiming(lines("0, 0, 4/4"));
		
		expect(r.errors.some(e => /bpm/i.test(e.message))).toBe(true);
	});
});