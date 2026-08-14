import { describe, expect, it } from "vitest";

import { parseLayout } from "./layout";

const lines = (...t: string[]) => t.map((text, i) => ({ lineNo: i + 1, text }));

describe("parseLayout", () => {
	it("parses a single-number layout", () => {
		const r = parseLayout(lines("Type: 4", "Special: None"));
		expect(r.errors).toEqual([]);
		expect(r.value).toEqual({ totalKeys: 4, normalKeys: 4, specialLanes: [] });
	});

	it("parses a hybrid layout with special lanes", () => {
		const r = parseLayout(lines("Type: 7+1", "Special: 7"));
		expect(r.value).toEqual({ totalKeys: 8, normalKeys: 7, specialLanes: [7] });
	});

	it("errors when a special index is out of range", () => {
		const r = parseLayout(lines("Type: 4", "Special: 9"));
		expect(r.value).toBeNull();
		expect(r.errors.some(e => /range/i.test(e.message))).toBe(true);
	});

	it("errors on duplicate special indices", () => {
		const r = parseLayout(lines("Type: 6+2", "Special: 6, 6"));
		expect(r.errors.some(e => /duplicate/i.test(e.message))).toBe(true);
	});
});