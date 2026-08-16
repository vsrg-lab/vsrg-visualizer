import { describe, it, expect } from "vitest";

import { parseUrc } from "./index";

const valid = [
	"@URC 1.1",
	"@Metadata",
	"Original: osu!mania",
	"Title: Song",
	"Artist: Artist",
	"Creator: Mapper",
	"Version: Normal",
	"@Layout",
	"Type: 4",
	"Special: None",
	"@Timing",
	"0, 120.0, 4/4, 1.0",
	"@Notes",
	"0, 0, N",
	"500, 1, LS",
	"1000, 1, LE"
].join("\n");

describe("parseUrc", () => {
	it("parses a full valid chart", () => {
		const r = parseUrc(valid);
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.source.metadata.title).toBe("Song");
		expect(r.source.layout.totalKeys).toBe(4);
		expect(r.source.timeAxis).toBe("ms");
		expect(r.source.bpmAffectsScroll).toBe(false);
		expect(r.source.events).toEqual([
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
			{ kind: "sv", at: 0, multiplier: 1 }
		]);
		expect(r.source.notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "hold", lane: 1, at: 500, end: 1000 }
		]);
	});

	it("aggregates errors from multiple sections, sorted by line", () => {
		const bad = "@URC 1.1\n@Metadata\nTitle: Song\n@Layout\nType: 4\n@Timing\n100, 120, 4/4\n@Notes\n0, 9, N";
		const r = parseUrc(bad);
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.length).toBeGreaterThan(1);
		const linesSorted = r.errors.map(e => e.line);
		expect([...linesSorted].sort((a, b) => a - b)).toEqual(linesSorted);
	});

	it("treats @Judgment as optional", () => {
		const r = parseUrc(valid);
		expect(r.ok).toBe(true);
	});
});
