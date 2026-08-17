import { describe, expect, it } from "vitest";

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

type Sections = { metadata?: string[]; layout?: string[]; timing?: string[]; notes?: string[] };

/** Assembles a minimal valid URC document, letting a test override just the section it cares about. */
function urcText(overrides: Sections): string {
	const metadata = overrides.metadata ?? [
		"Original: osu!mania",
		"Title: Song",
		"Artist: Artist",
		"Creator: Mapper",
		"Version: Normal"
	];
	const layout = overrides.layout ?? ["Type: 4", "Special: None"];
	const timing = overrides.timing ?? ["0, 120.0, 4/4, 1.0"];
	const notes = overrides.notes ?? ["0, 0, N"];

	return ["@URC 1.1", "@Metadata", ...metadata, "@Layout", ...layout, "@Timing", ...timing, "@Notes", ...notes].join("\n");
}

describe("parseUrc", () => {
	it("parses a full valid chart", () => {
		const r = parseUrc(valid);
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].metadata.title).toBe("Song");
		expect(r.sources[0].layout.totalKeys).toBe(4);
		expect(r.sources[0].timeAxis).toBe("ms");
		expect(r.sources[0].bpmAffectsScroll).toBe(false);
		expect(r.sources[0].events).toEqual([
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
			{ kind: "sv", at: 0, multiplier: 1 }
		]);
		expect(r.sources[0].notes).toEqual([
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

describe("metadata", () => {
	it("parses all required fields", () => {
		const r = parseUrc(urcText({}));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].metadata).toEqual({
			original: "osu!mania",
			title: "Song",
			artist: "Artist",
			creator: "Mapper",
			version: "Normal"
		});
	});

	it("errors on a missing required field", () => {
		const r = parseUrc(urcText({ metadata: ["Title: A", "Artist: B", "Creator: C", "Version: D"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /Original/.test(e.message))).toBe(true);
	});

	it("errors on an empty value", () => {
		const r = parseUrc(urcText({ metadata: ["Original: x", "Title:", "Artist: B", "Creator: C", "Version: D"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /Title/.test(e.message))).toBe(true);
	});
});

describe("layout", () => {
	it("parses a single-number layout", () => {
		const r = parseUrc(urcText({}));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].layout).toEqual({ totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 });
	});

	it("parses a hybrid layout with special lanes", () => {
		const r = parseUrc(urcText({ layout: ["Type: 7+1", "Special: 7"] }));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].layout).toEqual({ totalKeys: 8, normalKeys: 7, specialLanes: [7], stages: 1 });
	});

	it("errors when a special index is out of range", () => {
		const r = parseUrc(urcText({ layout: ["Type: 4", "Special: 9"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /range/i.test(e.message))).toBe(true);
	});

	it("errors on duplicate special indices", () => {
		const r = parseUrc(urcText({ layout: ["Type: 6+2", "Special: 6, 6"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /duplicate/i.test(e.message))).toBe(true);
	});
});

describe("timing", () => {
	it("parses points and defaults multiplier to 1.0", () => {
		const r = parseUrc(urcText({ timing: ["0, 120.0, 4/4", "1000, 150, 3/4, 1.5"] }));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].events).toEqual([
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
			{ kind: "sv", at: 0, multiplier: 1 },
			{ kind: "bpm", at: 1000, bpm: 150 },
			{ kind: "meter", at: 1000, beats: 3, noteValue: 4 },
			{ kind: "sv", at: 1000, multiplier: 1.5 }
		]);
	});

	it("errors when the first point is not at 0", () => {
		const r = parseUrc(urcText({ timing: ["100, 120, 4/4"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /first.*0/i.test(e.message))).toBe(true);
	});

	it("errors on non-ascending timestamps", () => {
		const r = parseUrc(urcText({ timing: ["0, 120, 4/4", "500, 120, 4/4", "400, 120, 4/4"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /ascending/i.test(e.message))).toBe(true);
	});

	it("errors on non-positive bpm", () => {
		const r = parseUrc(urcText({ timing: ["0, 0, 4/4"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /bpm/i.test(e.message))).toBe(true);
	});
});

describe("notes", () => {
	it("parses tap, mine, and fake notes", () => {
		const r = parseUrc(urcText({ notes: ["0, 0, N", "100, 1, M", "200, 2, F"] }));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "mine", at: 100, lane: 1 },
			{ kind: "fake", at: 200, lane: 2 }
		]);
	});

	it("pairs LS/LE into a hold on the same lane", () => {
		const r = parseUrc(urcText({ notes: ["0, 0, LS", "500, 0, LE"] }));
		expect(r.ok).toBe(true);

		if (!r.ok)
			return;

		expect(r.sources[0].notes).toEqual([{ kind: "hold", lane: 0, at: 0, end: 500 }]);
	});

	it("errors on an unpaired LS", () => {
		const r = parseUrc(urcText({ notes: ["0, 0, LS"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /unpaired/i.test(e.message))).toBe(true);
	});

	it("errors on an unpaired LE", () => {
		const r = parseUrc(urcText({ notes: ["500, 0, LE"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /unpaired/i.test(e.message))).toBe(true);
	});

	it("errors on overlapping holds in one lane", () => {
		const r = parseUrc(urcText({ notes: ["0, 0, LS", "100, 0, LS", "200, 0, LE", "300, 0, LE"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /overlap/i.test(e.message))).toBe(true);
	});

	it("errors on a lane index out of range", () => {
		const r = parseUrc(urcText({ notes: ["0, 4, N"] }));
		expect(r.ok).toBe(false);

		if (r.ok)
			return;

		expect(r.errors.some(e => /lane/i.test(e.message))).toBe(true);
	});
});
