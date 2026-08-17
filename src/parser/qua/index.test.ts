import { describe, expect, it } from "vitest";

import { parseQua } from "./index";

const qua = [
	"AudioFile: audio.mp3",
	"Title: Song",
	"Artist: Artist",
	"Creator: Mapper",
	"DifficultyName: Insane",
	"Mode: Keys4",
	"HasScratchKey: false",
	"BPMDoesNotAffectScrollVelocity: true",
	"InitialScrollVelocity: 0.9",
	"TimingPoints:",
	"- StartTime: 0",
	"  Bpm: 120",
	"SliderVelocities:",
	"- StartTime: 1000",
	"  Multiplier: 2",
	"HitObjects:",
	"- StartTime: 0",
	"  Lane: 1",
	"- StartTime: 500",
	"  Lane: 2",
	"  EndTime: 1500",
	"- StartTime: 750",
	"  Lane: 3",
	"  Type: Mine"
].join("\n");

describe("parseQua", () => {
	it("parses metadata, layout and axis", () => {
		const result = parseQua(qua);
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.sources[0].metadata).toEqual({
			original: "Quaver",
			title: "Song",
			artist: "Artist",
			creator: "Mapper",
			version: "Insane"
		});
		expect(result.sources[0].layout).toEqual({ totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 });
		expect(result.sources[0].timeAxis).toBe("ms");
		expect(result.sources[0].bpmAffectsScroll).toBe(false);
	});

	it("converts lanes from 1-based and reads hold ends and mines", () => {
		const result = parseQua(qua);

		if (!result.ok)
			return;

		expect(result.sources[0].notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "hold", lane: 1, at: 500, end: 1500 },
			{ kind: "mine", at: 750, lane: 2 }
		]);
	});

	it("emits the initial scroll velocity at the first timing point", () => {
		const result = parseQua(qua);

		if (!result.ok)
			return;

		expect(result.sources[0].events).toContainEqual({ kind: "sv", at: 0, multiplier: 0.9 });
		expect(result.sources[0].events).toContainEqual({ kind: "sv", at: 1000, multiplier: 2 });
	});

	it("adds a scratch lane as the highest lane", () => {
		const result = parseQua(qua.replace("HasScratchKey: false", "HasScratchKey: true"));

		if (!result.ok)
			return;

		expect(result.sources[0].layout).toEqual({ totalKeys: 5, normalKeys: 4, specialLanes: [4], stages: 1 });
	});

	it("honours BPMDoesNotAffectScrollVelocity", () => {
		const result = parseQua(qua.replace("BPMDoesNotAffectScrollVelocity: true", "BPMDoesNotAffectScrollVelocity: false"));

		if (!result.ok)
			return;

		expect(result.sources[0].bpmAffectsScroll).toBe(true);
	});

	it("warns about timing groups it ignores", () => {
		const result = parseQua(`${qua}\nTimingGroups:\n  custom:\n    StartTime: 0`);

		if (!result.ok)
			return;

		expect(result.warnings?.some(w => w.code === "timing-groups-ignored")).toBe(true);
	});

	it("fails on unparseable yaml", () => {
		const result = parseQua("Title: [unclosed");
		expect(result.ok).toBe(false);
	});
});
