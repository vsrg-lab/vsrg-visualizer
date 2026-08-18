import { describe, expect, it } from "vitest";

import { loadChart } from "./index";

const urc = [
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

const osu = [
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
	"",
	"[HitObjects]",
	"64,192,0,1,0,0:0:0:0:"
].join("\n");

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
	"HitObjects:",
	"- StartTime: 0",
	"  Lane: 1"
].join("\n");

const sm = [
	"#TITLE:Song;",
	"#ARTIST:Artist;",
	"#BPMS:0.000=120.000;",
	"#NOTES:",
	"     dance-single:",
	"     :",
	"     Hard:",
	"     8:",
	"     0,0,0,0,0:",
	"1000",
	"0100",
	"0010",
	"0001",
	";"
].join("\n");

const bms = [
	"#BPM 120",
	"#TITLE Song",
	"#00011:01",
	"#00112:01"
].join("\n");

const randomBms = [
	"#BPM 120",
	"#RANDOM 2",
	"#IF 1",
	"#00011:01",
	"#ENDIF",
	"#IF 2",
	"#00012:01",
	"#ENDIF",
	"#ENDRANDOM"
].join("\n");

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("loadChart - URC & General", () => {
	it("loads a .urc file into a one-chart set", () => {
		const result = loadChart(bytes(urc), "song.urc");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("urc");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes).toHaveLength(2);
		expect(result.set.charts[0].timing[0].timeMs).toBe(0);
	});

	it("detects urc from content when the extension is wrong", () => {
		const result = loadChart(bytes(urc), "song.txt");
		expect(result.ok).toBe(true);
	});

	it("strips a UTF-8 BOM before parsing", () => {
		const result = loadChart(bytes("﻿" + urc), "song.urc");
		expect(result.ok).toBe(true);
	});

	it("fails with a clear error on an unrecognized file", () => {
		const result = loadChart(bytes("hello world"), "song.txt");
		expect(result.ok).toBe(false);

		if (result.ok)
			return;

		expect(result.errors[0].message).toMatch(/unrecognized|unknown/i);
	});
});

describe("loadChart - osu!mania", () => {
	it("loads a .osu file", () => {
		const result = loadChart(bytes(osu), "song.osu");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("osu");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes).toHaveLength(1);
	});

	it("detects osu!mania from content when the extension is wrong", () => {
		const result = loadChart(bytes(osu), "song.txt");
		expect(result.ok).toBe(true);
	});
});

describe("loadChart - Quaver", () => {
	it("loads a .qua file", () => {
		const result = loadChart(bytes(qua), "song.qua");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("qua");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes).toHaveLength(1);
	});

	it("detects Quaver from content when the extension is missing", () => {
		const result = loadChart(bytes(qua), "song");
		expect(result.ok).toBe(true);
	});
});

describe("loadChart - StepMania", () => {
	it("loads a .sm file", () => {
		const result = loadChart(bytes(sm), "song.sm");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("sm");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes).toHaveLength(4);
	});

	it("detects StepMania from content when the extension is missing", () => {
		const result = loadChart(bytes(sm), "song");
		expect(result.ok).toBe(true);
	});
});

describe("loadChart - BMS", () => {
	it("loads a .bms file", () => {
		const result = loadChart(bytes(bms), "song.bms");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("bms");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes.length).toBeGreaterThan(0);
	});

	it("detects BMS from content when the extension is missing", () => {
		const result = loadChart(bytes(bms), "song");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("bms");
	});

	it("loads a .pms file as BMS with the 9-key layout", () => {
		const result = loadChart(bytes(bms), "song.pms");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("bms");
		expect(result.set.charts[0].layout.totalKeys).toBe(9);
	});

	it("produces deterministic results with an injected rng", () => {
		const first = loadChart(bytes(randomBms), "song.bms", { rng: () => 1 });
		const second = loadChart(bytes(randomBms), "song.bms", { rng: () => 1 });
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);

		if (!first.ok || !second.ok)
			return;

		expect(second.set.charts[0].notes).toEqual(first.set.charts[0].notes);
	});
});
