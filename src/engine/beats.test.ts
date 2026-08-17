import { describe, expect, it } from "vitest";

import { generateBeatLines, type BeatSegment } from "./beats";

function segment(over: Partial<BeatSegment>): BeatSegment {
	return {
		timeMs: 0,
		endMs: 1000,
		bpm: 120,
		beatsPerMeasure: 4,
		resetsMeasure: false,
		stopped: false,
		...over
	};
}

describe("generateBeatLines", () => {
	it("puts a beat every 60000/bpm and a measure line every meter.beats", () => {
		const lines = generateBeatLines([segment({ endMs: 2001, resetsMeasure: true })], 2000);

		expect(lines.map(l => l.timeMs)).toEqual([0, 500, 1000, 1500, 2000]);
		expect(lines.map(l => l.isMeasure)).toEqual([true, false, false, false, true]);
	});

	it("keeps the beat phase across a bpm change instead of restarting it", () => {
		const lines = generateBeatLines([
			segment({ timeMs: 0, endMs: 750, bpm: 120, resetsMeasure: true }),
			segment({ timeMs: 750, endMs: 2001, bpm: 240 })
		], 2000);

		// beats at 0, 500 belong to the first span; the next beat is still due at 1000,
		// and only from there does the 240bpm spacing (250ms) apply
		expect(lines.map(l => l.timeMs)).toEqual([0, 500, 1000, 1250, 1500, 1750, 2000]);
	});

	it("does not reset the measure count on a span that carries no meter change", () => {
		const lines = generateBeatLines([
			segment({ timeMs: 0, endMs: 750, resetsMeasure: true }),
			segment({ timeMs: 750, endMs: 3001 })
		], 3000);

		// measure lines stay on the 4-beat grid: 0 and 2000, not 0 and 1000
		expect(lines.filter(l => l.isMeasure).map(l => l.timeMs)).toEqual([0, 2000]);
	});

	it("restarts the measure count where a meter change begins", () => {
		const lines = generateBeatLines([
			segment({ timeMs: 0, endMs: 1000, resetsMeasure: true }),
			segment({ timeMs: 1000, endMs: 3001, beatsPerMeasure: 3, resetsMeasure: true })
		], 3000);

		expect(lines.filter(l => l.isMeasure).map(l => l.timeMs)).toEqual([0, 1000, 2500]);
	});

	it("emits no beats during a stop and resumes in phase afterwards", () => {
		const lines = generateBeatLines([
			segment({ timeMs: 0, endMs: 1000, resetsMeasure: true }),
			segment({ timeMs: 1000, endMs: 1300, stopped: true }),
			segment({ timeMs: 1300, endMs: 3001 })
		], 3000);

		// the beat due at 1000 is pushed to 1300 by the 300ms pause, and the grid follows from there
		expect(lines.map(l => l.timeMs)).toEqual([0, 500, 1300, 1800, 2300, 2800]);
		expect(lines.filter(l => l.isMeasure).map(l => l.timeMs)).toEqual([0, 2300]);
	});

	it("stops at endMs", () => {
		const lines = generateBeatLines([segment({ endMs: 10000, resetsMeasure: true })], 1200);

		expect(lines.map(l => l.timeMs)).toEqual([0, 500, 1000]);
	});

	it("returns nothing for an empty segment list", () => {
		expect(generateBeatLines([], 1000)).toEqual([]);
	});
});
