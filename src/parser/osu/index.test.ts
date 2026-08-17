import { describe, expect, it } from "vitest";

import { parseOsu } from "./index";

const chart = [
	"osu file format v14",
	"",
	"[General]",
	"Mode: 3",
	"SpecialStyle: 0",
	"",
	"[Metadata]",
	"Title:Song",
	"Artist:Artist",
	"Creator:Mapper",
	"Version:Insane",
	"",
	"[Difficulty]",
	"CircleSize:4",
	"",
	"[TimingPoints]",
	"0,500,4,2,0,60,1,0",
	"1000,-50,4,2,0,60,0,0",
	"",
	"[HitObjects]",
	"64,192,0,1,0,0:0:0:0:",
	"192,192,500,128,0,1500:0:0:0:0:"
].join("\n");

describe("parseOsu", () => {
	it("parses a mania chart into a source chart", () => {
		const result = parseOsu(chart);
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.sources[0].timeAxis).toBe("ms");
		expect(result.sources[0].bpmAffectsScroll).toBe(true);
		expect(result.sources[0].metadata).toEqual({
			original: "osu!mania",
			title: "Song",
			artist: "Artist",
			creator: "Mapper",
			version: "Insane"
		});
		expect(result.sources[0].layout).toEqual({ totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 });
	});

	it("turns an uninherited point into bpm, meter and an sv reset", () => {
		const result = parseOsu(chart);

		if (!result.ok)
			return;

		expect(result.sources[0].events.slice(0, 3)).toEqual([
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
			{ kind: "sv", at: 0, multiplier: 1 }
		]);
	});

	it("reads an inherited point as -100/beatLength", () => {
		const result = parseOsu(chart);

		if (!result.ok)
			return;

		expect(result.sources[0].events).toContainEqual({ kind: "sv", at: 1000, multiplier: 2 });
	});

	it("maps x to a column and reads the hold end time", () => {
		const result = parseOsu(chart);

		if (!result.ok)
			return;

		expect(result.sources[0].notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "hold", lane: 1, at: 500, end: 1500 }
		]);
	});

	it("maps the column edges correctly", () => {
		const withEdges = chart.replace(
			"64,192,0,1,0,0:0:0:0:",
			["0,192,0,1,0,0:0:0:0:", "511,192,10,1,0,0:0:0:0:"].join("\n")
		);
		const result = parseOsu(withEdges);

		if (!result.ok)
			return;

		expect(result.sources[0].notes[0]).toEqual({ kind: "tap", at: 0, lane: 0 });
		expect(result.sources[0].notes[1]).toEqual({ kind: "tap", at: 10, lane: 3 });
	});

	it("puts the special lane leftmost when SpecialStyle is on", () => {
		const result = parseOsu(chart.replace("SpecialStyle: 0", "SpecialStyle: 1"));

		if (!result.ok)
			return;

		expect(result.sources[0].layout.specialLanes).toEqual([0]);
		expect(result.sources[0].layout.normalKeys).toBe(3);
	});

	it("infers a double stage above ten keys and warns", () => {
		const result = parseOsu(chart.replace("CircleSize:4", "CircleSize:14"));

		if (!result.ok)
			return;

		expect(result.sources[0].layout.stages).toBe(2);
		expect(result.warnings?.some(w => w.code === "stages-inferred")).toBe(true);
	});

	it("rejects a file that is not osu!mania", () => {
		const result = parseOsu(chart.replace("Mode: 3", "Mode: 0"));
		expect(result.ok).toBe(false);

		if (result.ok)
			return;

		expect(result.errors[0].message).toMatch(/mania/i);
	});

	it("rejects a file without the format header", () => {
		const result = parseOsu(chart.replace("osu file format v14", "junk"));
		expect(result.ok).toBe(false);
	});
});
