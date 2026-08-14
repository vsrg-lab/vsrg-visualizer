import { describe, it, expect } from "vitest";

import { parseNotes } from "./notes";

const lines = (...t: string[]) => t.map((text, i) => ({ lineNo: i + 1, text }));

describe("parseNotes", () => {
	it("parses tap, mine, and fake notes", () => {
		const r = parseNotes(lines("0, 0, N", "100, 1, M", "200, 2, F"), 4);
		expect(r.errors).toEqual([]);
		expect(r.value).toEqual([
			{ kind: "tap", timeMs: 0, lane: 0 },
			{ kind: "mine", timeMs: 100, lane: 1 },
			{ kind: "fake", timeMs: 200, lane: 2 }
		]);
	});

	it("pairs LS/LE into a hold on the same lane", () => {
		const r = parseNotes(lines("0, 0, LS", "500, 0, LE"), 4);
		expect(r.value).toEqual([{ kind: "hold", lane: 0, startMs: 0, endMs: 500 }]);
	});

	it("errors on an unpaired LS", () => {
		const r = parseNotes(lines("0, 0, LS"), 4);
		expect(r.value).toBeNull();
		expect(r.errors.some(e => /unpaired/i.test(e.message))).toBe(true);
	});

	it("errors on an unpaired LE", () => {
		const r = parseNotes(lines("500, 0, LE"), 4);
		expect(r.errors.some(e => /unpaired/i.test(e.message))).toBe(true);
	});

	it("errors on overlapping holds in one lane", () => {
		const r = parseNotes(lines("0, 0, LS", "100, 0, LS", "200, 0, LE", "300, 0, LE"), 4);
		expect(r.errors.some(e => /overlap/i.test(e.message))).toBe(true);
	});

	it("errors on a lane index out of range", () => {
		const r = parseNotes(lines("0, 4, N"), 4);
		expect(r.errors.some(e => /lane/i.test(e.message))).toBe(true);
	});
});
