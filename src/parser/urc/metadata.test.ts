import { describe, expect, it } from "vitest";

import { parseMetadata } from "./metadata";

const lines = (...t: string[]) => t.map((text, i) => ({ lineNo: i + 1, text }));

describe("parseMetadata", () => {
	it("parses all required fields", () => {
		const r = parseMetadata(lines("Original: osu!mania", "Title: A", "Artist: B", "Creator: C", "Version: D"));
		expect(r.errors).toEqual([]);
		expect(r.value).toEqual({ original: "osu!mania", title: "A", artist: "B", creator: "C", version: "D" });
	});

	it("errors on a missing required field", () => {
		const r = parseMetadata(lines("Title: A", "Artist: B", "Creator: C", "Version: D"));
		expect(r.value).toBeNull();
		expect(r.errors.some(e => /Original/.test(e.message))).toBe(true);
	});

	it("errors on an empty value", () => {
		const r = parseMetadata(lines("Original: x", "Title:", "Artist: B", "Creator: C", "Version: D"));
		expect(r.errors.some(e => /Title/.test(e.message))).toBe(true);
	});
});