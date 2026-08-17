import { describe, expect, it } from "vitest";

import { parseSm } from "./index";

const sm = [
	"#TITLE:Song;",
	"#ARTIST:Artist;",
	"#CREDIT:Mapper;",
	"#OFFSET:-0.500;",
	"#BPMS:0.000=120.000,4.000=240.000;",
	"#STOPS:8.000=0.500;",
	"#NOTES:",
	"     dance-single:",
	"     Charter:",
	"     Challenge:",
	"     12:",
	"     0,0,0,0,0:",
	"1000",
	"0100",
	"0010",
	"0001",
	",",
	"2000",
	"0000",
	"3000",
	"0000",
	";"
].join("\n");

describe("parseSm", () => {
	it("reads song metadata and the chart list", () => {
		const result = parseSm(sm);
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.sources).toHaveLength(1);
		expect(result.sources[0].metadata).toEqual({
			original: "StepMania",
			title: "Song",
			artist: "Artist",
			creator: "Mapper",
			version: "Challenge 12"
		});
		expect(result.sources[0].layout).toEqual({
			totalKeys: 4,
			normalKeys: 4,
			specialLanes: [],
			stages: 1
		});
		expect(result.sources[0].timeAxis).toBe("beat");
		expect(result.sources[0].bpmAffectsScroll).toBe(true);
	});

	it("places notes on the beat axis with four beats per measure", () => {
		const result = parseSm(sm);

		if (!result.ok)
			return;

		expect(result.sources[0].notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "tap", at: 1, lane: 1 },
			{ kind: "tap", at: 2, lane: 2 },
			{ kind: "tap", at: 3, lane: 3 },
			{ kind: "hold", lane: 0, at: 4, end: 6 }
		]);
	});

	it("emits bpm, stop and a meter anchor at beat 0", () => {
		const result = parseSm(sm);

		if (!result.ok)
			return;

		expect(result.sources[0].events).toContainEqual({ kind: "bpm", at: 0, bpm: 120 });
		expect(result.sources[0].events).toContainEqual({ kind: "bpm", at: 4, bpm: 240 });
		expect(result.sources[0].events).toContainEqual({
			kind: "stop",
			at: 8,
			duration: { unit: "ms", value: 500 }
		});
		expect(result.sources[0].events).toContainEqual({ kind: "meter", at: 0, beats: 4, noteValue: 4 });
	});

	it("turns a negative bpm span into a warp", () => {
		const result = parseSm(sm.replace("#BPMS:0.000=120.000,4.000=240.000;", "#BPMS:0.000=120.000,2.000=-1.000,3.000=120.000;"));

		if (!result.ok)
			return;

		expect(result.sources[0].events).toContainEqual({ kind: "warp", at: 2, lengthBeats: 1 });
		expect(result.sources[0].events.some(e => e.kind === "bpm" && e.bpm < 0)).toBe(false);
	});

	it("turns a negative stop into a warp", () => {
		const result = parseSm(sm.replace("#STOPS:8.000=0.500;", "#STOPS:8.000=-0.500;"));

		if (!result.ok)
			return;

		expect(result.sources[0].events.some(e => e.kind === "warp" && e.at === 8)).toBe(true);
	});

	it("multiplies #SCROLLS and #SPEEDS into one sv timeline", () => {
		const result = parseSm(sm.replace("#STOPS:8.000=0.500;", "#STOPS:8.000=0.500;\n#SCROLLS:0.000=2.000;\n#SPEEDS:0.000=0.500=0.000=0;"));

		if (!result.ok)
			return;

		expect(result.sources[0].events).toContainEqual({ kind: "sv", at: 0, multiplier: 1 });
	});

	it("marks notes inside a #FAKES region as fake", () => {
		// the region covers beats 1.0 up to (but not including) 1.5, so only the beat-1 note is caught
		const result = parseSm(sm.replace("#STOPS:8.000=0.500;", "#STOPS:8.000=0.500;\n#FAKES:1.000=0.500;"));

		if (!result.ok)
			return;

		expect(result.sources[0].notes[1]).toEqual({ kind: "fake", at: 1, lane: 1 });
		expect(result.sources[0].notes[2]).toEqual({ kind: "tap", at: 2, lane: 2 });
	});

	it("skips a chart whose stepstype is unknown but keeps the file", () => {
		const twoCharts = `${sm}\n${sm.slice(sm.indexOf("#NOTES:")).replace("dance-single", "pump-routine-quad")}`;
		const result = parseSm(twoCharts);

		if (!result.ok)
			return;

		expect(result.sources).toHaveLength(1);
		expect(result.warnings?.some(w => w.code === "unknown-stepstype")).toBe(true);
	});

	it("reads .ssc note data blocks and per-chart timing overrides", () => {
		const ssc = [
			"#VERSION:0.83;",
			"#TITLE:Song;",
			"#ARTIST:Artist;",
			"#BPMS:0.000=120.000;",
			"#NOTEDATA:;",
			"#CHARTNAME:Alpha;",
			"#STEPSTYPE:dance-single;",
			"#DIFFICULTY:Hard;",
			"#METER:9;",
			"#BPMS:0.000=200.000;",
			"#NOTES:",
			"1000",
			"0000",
			"0000",
			"0000",
			";",
			"#NOTEDATA:;",
			"#CHARTNAME:Beta;",
			"#STEPSTYPE:dance-single;",
			"#DIFFICULTY:Easy;",
			"#METER:3;",
			"#NOTES:",
			"0001",
			"0000",
			"0000",
			"0000",
			";"
		].join("\n");
		const result = parseSm(ssc);
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.sources).toHaveLength(2);
		expect(result.sources[0].metadata.version).toBe("Hard 9");
		// the chart-level #BPMS replaces the song-level one outright
		expect(result.sources[0].events).toContainEqual({ kind: "bpm", at: 0, bpm: 200 });
		expect(result.sources[1].events).toContainEqual({ kind: "bpm", at: 0, bpm: 120 });
		expect(result.sources[1].notes).toEqual([{ kind: "tap", at: 0, lane: 3 }]);
	});

	it("fails when the file holds no usable chart", () => {
		const result = parseSm("#TITLE:Song;\n#BPMS:0.000=120.000;");
		expect(result.ok).toBe(false);
	});
});
