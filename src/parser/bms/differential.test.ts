import { Compiler } from "bms";
import { describe, expect, it } from "vitest";

import { parseBms } from "./index";
import type { Rng } from "./preprocess";

const rng: Rng = () => 1;

function parse(lines: string[]) {
	const result = parseBms(new TextEncoder().encode(lines.join("\n")).buffer, rng, false);
	if (!result.ok)
		throw new Error(`parse failed: ${result.errors[0]?.message}`);
	return result.sources[0]!;
}

/** Compiles the same fixture with bms-js under the same rng. */
function oracle(lines: string[]) {
	return Compiler.compile(lines.join("\n"), { rng }).chart;
}

/** Sorts and rounds so float noise from two different beat computations cannot fail the diff. */
function rounded(values: number[]): number[] {
	return values.map(value => Math.round(value * 1e6) / 1e6).sort((a, b) => a - b);
}

function ourNoteBeats(chart: ReturnType<typeof parse>): number[] {
	return rounded(chart.notes.map(note => note.at));
}

function oracleNoteBeats(chart: ReturnType<typeof oracle>): number[] {
	return rounded(chart.objects.allSorted()
		.filter(object => /^1[1-9]$/.test(object.channel) && object.value !== "00")
		.map(object => chart.measureToBeat(object.measure, object.fraction)));
}

describe("differential against bms-js", () => {
	it("agrees on note beats for a basic multi-channel chart", () => {
		const lines = [
			"#BPM 140",
			"#00011:010100",
			"#00016:01",
			"#00019:01",
			"#00111:000100",
			"#00118:01",
			"#00212:0102",
			"#00313:0201"
		];
		expect(ourNoteBeats(parse(lines))).toEqual(oracleNoteBeats(oracle(lines)));
	});

	it("agrees on measure sizes and bpm changes with variable measures", () => {
		const lines = [
			"#BPM 150",
			"#BPM01 90",
			"#STOP01 24",
			"#00003:78",
			"#00102:0.75",
			"#00202:1.25",
			"#00302:0.5",
			"#00111:0102",
			"#00208:01",
			"#00312:01"
		];
		const ours = parse(lines);
		const theirs = oracle(lines);

		expect(ourNoteBeats(ours)).toEqual(oracleNoteBeats(theirs));

		const meters = ours.events.filter(event => event.kind === "meter");
		for (let measure = 0; measure < meters.length; measure++)
			expect(theirs.timeSignatures.get(measure)).toBe(meters[measure]!.beats / 4);

		const table = new Map(lines
			.filter(line => line.startsWith("#BPM"))
			.map(line => [line.slice(1).split(" ")[0], Number(line.split(" ")[1])]));
		const oracleBpms = theirs.objects.allSorted()
			.filter(object => object.channel === "03" || object.channel === "08")
			.map(object => ({
				at: theirs.measureToBeat(object.measure, object.fraction),
				bpm: object.channel === "03" ? Number.parseInt(object.value, 16) : table.get("BPM" + object.value)!
			}));
		const ourBpms = ours.events
			.filter(event => event.kind === "bpm")
			.slice(1) // events[0] is the initial #BPM, which bms-js keeps in headers instead
			.map(event => ({ at: event.at, bpm: event.bpm }));
		expect(ourBpms).toEqual(oracleBpms);
	});

	it("agrees on a #RANDOM chart under the same injected rng", () => {
		const lines = [
			"#BPM 170",
			"#RANDOM 2",
			"#IF 1",
			"#00011:01",
			"#ENDIF",
			"#IF 2",
			"#00012:01",
			"#ENDIF",
			"#ENDRANDOM",
			"#00111:01"
		];
		expect(ourNoteBeats(parse(lines))).toEqual(oracleNoteBeats(oracle(lines)));
	});
});
