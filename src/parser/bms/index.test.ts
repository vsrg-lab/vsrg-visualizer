import { describe, expect, it } from "vitest";

import { parseBms } from "./index";

const rng = () => 1;

function encode(lines: string[]): ArrayBuffer {
	return new TextEncoder().encode(lines.join("\n")).buffer;
}

function parse(lines: string[], isPms = false) {
	const result = parseBms(encode(lines), rng, isPms);
	if (!result.ok)
		throw new Error(`parse failed: ${result.errors[0]?.message}`);
	return result;
}

const bms7k = [
	"#PLAYER 1",
	"#TITLE Sample BMS",
	"#ARTIST Artist",
	"#SUBARTIST Charter",
	"#BPM 120",
	"#DIFFICULTY 4",
	"#PLAYLEVEL 5",
	"#LNTYPE 1",
	"#BPM01 180",
	"#STOP01 48",
	"#SCROLL01 2",
	"#SPEED01 0.75",
	"#00003:96",
	"#00011:0100",
	"#00016:01",
	"#00018:01",
	"#00102:0.500",
	"#00108:01",
	"#00111:0102",
	"#00209:01",
	"#00251:0102",
	"#003D1:01",
	"#004SC:01",
	"#004SP:01"
];

describe("parseBms", () => {
	it("parses the 7-key fixture", () => {
		const chart = parse(bms7k).sources[0]!;
		expect(chart.layout).toEqual({ totalKeys: 8, normalKeys: 7, specialLanes: [0], stages: 1 });
		expect(chart.timeAxis).toBe("beat");
		expect(chart.bpmAffectsScroll).toBe(true);
		expect(chart.metadata).toEqual({
			original: "BMS",
			title: "Sample BMS",
			artist: "Artist",
			creator: "Charter",
			version: "ANOTHER 5"
		});
	});

	it("maps channels to lanes and beats", () => {
		const chart = parse(bms7k).sources[0]!;
		expect(chart.notes).toContainEqual({ kind: "tap", at: 0, lane: 1 });
		expect(chart.notes).toContainEqual({ kind: "tap", at: 0, lane: 0 });
		expect(chart.notes).toContainEqual({ kind: "tap", at: 0, lane: 6 });
		expect(chart.notes).toContainEqual({ kind: "tap", at: 4, lane: 1 });
		expect(chart.notes).toContainEqual({ kind: "tap", at: 5, lane: 1 });
		expect(chart.notes).toContainEqual({ kind: "mine", at: 10, lane: 1 });
	});

	it("emits a meter event at every measure start with accumulated beats", () => {
		const events = parse(bms7k).sources[0]!.events.filter(event => event.kind === "meter");
		expect(events).toEqual([
			{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
			{ kind: "meter", at: 4, beats: 2, noteValue: 4 },
			{ kind: "meter", at: 6, beats: 4, noteValue: 4 },
			{ kind: "meter", at: 10, beats: 4, noteValue: 4 },
			{ kind: "meter", at: 14, beats: 4, noteValue: 4 }
		]);
	});

	it("supports fractional measure ratios", () => {
		const events = parse(["#BPM 120", "#00011:01", "#00102:0.4375", "#00111:01"])
			.sources[0]!.events.filter(event => event.kind === "meter");
		expect(events[1]).toEqual({ kind: "meter", at: 4, beats: 1.75, noteValue: 4 });
	});

	it("reads channel 03 as hex and channel 08 as a #BPMxx reference", () => {
		const events = parse(bms7k).sources[0]!.events.filter(event => event.kind === "bpm");
		expect(events).toEqual([
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "bpm", at: 0, bpm: 150 },
			{ kind: "bpm", at: 4, bpm: 180 }
		]);
	});

	it("converts #STOPxx counts into beats", () => {
		const events = parse(bms7k).sources[0]!.events.filter(event => event.kind === "stop");
		expect(events).toEqual([{ kind: "stop", at: 6, duration: { unit: "beats", value: 1 } }]);
	});

	it("demotes an unpaired LN start to a tap with a warning", () => {
		const result = parse(["#BPM 120", "#LNTYPE 1", "#00051:01"]);
		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 0, lane: 0 }]);
		expect(result.warnings?.some(warning => warning.code === "unpaired-ln")).toBe(true);
	});

	it("turns the previous same-lane tap into a hold via #LNOBJ", () => {
		const chart = parse(["#BPM 120", "#LNOBJ 05", "#00011:0105"]).sources[0]!;
		expect(chart.notes).toEqual([{ kind: "hold", lane: 0, at: 0, end: 2 }]);
	});

	it("demotes LN channels to taps when #LNTYPE deactivates them", () => {
		const result = parse(["#BPM 120", "#LNTYPE 2", "#00051:0102"]);
		expect(result.sources[0]!.notes).toEqual([
			{ kind: "tap", at: 0, lane: 0 },
			{ kind: "tap", at: 2, lane: 0 }
		]);
		expect(result.warnings?.some(warning => warning.code === "lntype-ignored")).toBe(true);
	});

	it("multiplies SC and SP into a single sv event", () => {
		const events = parse(bms7k).sources[0]!.events.filter(event => event.kind === "sv");
		expect(events).toEqual([{ kind: "sv", at: 14, multiplier: 1.5 }]);
	});

	it("detects 5-key, 9-key, and 14-key layouts", () => {
		expect(parse(["#BPM 120", "#00011:01"]).sources[0]!.layout)
			.toEqual({ totalKeys: 5, normalKeys: 5, specialLanes: [], stages: 1 });
		expect(parse(["#BPM 120", "#00011:01", "#00022:01"], true).sources[0]!.layout)
			.toEqual({ totalKeys: 9, normalKeys: 9, specialLanes: [], stages: 1 });
		expect(parse(["#BPM 120", "#00011:01", "#00016:01", "#00018:01", "#00021:01", "#00026:01"]).sources[0]!.layout)
			.toEqual({ totalKeys: 16, normalKeys: 14, specialLanes: [0, 15], stages: 2 });
	});

	it("resolves #RANDOM branches with the injected rng", () => {
		const result = parse([
			"#BPM 120",
			"#RANDOM 2",
			"#IF 1",
			"#00011:01",
			"#ENDIF",
			"#IF 2",
			"#00012:01",
			"#ENDIF",
			"#ENDRANDOM"
		]);
		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 0, lane: 0 }]);
		expect(result.warnings?.some(warning => warning.code === "random-branch")).toBe(true);
	});

	it("fails without an initial #BPM or with no notes", () => {
		expect(parseBms(encode(["#TITLE x", "#00011:01"]), rng, false).ok).toBe(false);
		expect(parseBms(encode(["#BPM 120"]), rng, false).ok).toBe(false);
	});

	it("warns on unknown channels and ignores empty channel data", () => {
		const result = parse(["#BPM 120", "#00011:01", "#000AF:01", "#00011:"]);
		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 0, lane: 0 }]);
		expect(result.warnings?.some(warning => warning.code === "unknown-channel")).toBe(true);
	});

	it("trims an odd-length channel payload with a warning", () => {
		const result = parse(["#BPM 120", "#00011:010"]);
		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 0, lane: 0 }]);
		expect(result.warnings?.some(warning => warning.code === "odd-channel-data")).toBe(true);
	});
});
