import { describe, expect, it } from "vitest";

import { compileChart } from "./compile";
import type { SourceChart, SourceNote, TimingEvent } from "../model/source";
import type { Layout, Metadata } from "../model/types";

const layout: Layout = { totalKeys: 4, normalKeys: 4, specialLanes: [], stages: 1 };
const metadata: Metadata = { original: "test", title: "T", artist: "A", creator: "C", version: "V" };

function source(over: Partial<SourceChart>): SourceChart {
	return {
		metadata,
		layout,
		timeAxis: "ms",
		bpmAffectsScroll: false,
		events: [],
		notes: [],
		...over
	};
}

const tap = (at: number, lane = 0): SourceNote => ({ kind: "tap", at, lane });

describe("compileChart - ms axis", () => {
	it("maps bpm and meter events straight onto timing points", () => {
		const events: TimingEvent[] = [
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "meter", at: 0, beats: 3, noteValue: 4 },
			{ kind: "bpm", at: 2000, bpm: 180 }
		];
		const { chart } = compileChart(source({ events, notes: [tap(0), tap(4000)] }));

		expect(chart.timing).toEqual([
			{ timeMs: 0, bpm: 120, meter: { beats: 3, noteValue: 4 }, multiplier: 1 },
			{ timeMs: 2000, bpm: 180, meter: { beats: 3, noteValue: 4 }, multiplier: 1 }
		]);
	});

	it("multiplies sv into the multiplier when bpm does not affect scroll", () => {
		const events: TimingEvent[] = [
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "sv", at: 1000, multiplier: 2.5 }
		];
		const { chart } = compileChart(source({ events, notes: [tap(0), tap(2000)] }));

		expect(chart.timing.map(p => p.multiplier)).toEqual([1, 2.5]);
		expect(chart.scroll).toEqual({ bpmAffectsScroll: false, baseBpm: 120 });
	});

	it("folds bpm into the multiplier when bpm affects scroll", () => {
		const events: TimingEvent[] = [
			{ kind: "bpm", at: 0, bpm: 120 },
			{ kind: "bpm", at: 1000, bpm: 180 },
			{ kind: "sv", at: 3000, multiplier: 0.8 }
		];
		const { chart } = compileChart(source({
			bpmAffectsScroll: true,
			events,
			notes: [tap(0), tap(4000)]
		}));

		// baseBpm = 120 (0-1000ms) vs 180 (1000-4000ms) -> 180 wins on duration
		expect(chart.scroll.baseBpm).toBe(180);
		expect(chart.timing.map(p => p.multiplier)).toEqual([120 / 180, 1, 0.8]);
	});

	it("breaks a base-bpm tie in favour of the first one seen", () => {
		const events: TimingEvent[] = [
			{ kind: "bpm", at: 0, bpm: 100 },
			{ kind: "bpm", at: 1000, bpm: 200 }
		];
		const { chart } = compileChart(source({ events, notes: [tap(0), tap(2000)] }));

		expect(chart.scroll.baseBpm).toBe(100);
	});

	it("copies note times unchanged and carries metadata and layout through", () => {
		const events: TimingEvent[] = [{ kind: "bpm", at: 0, bpm: 120 }];
		const notes: SourceNote[] = [
			{ kind: "hold", lane: 2, at: 500, end: 1500 },
			{ kind: "mine", at: 250, lane: 1 }
		];
		const { chart } = compileChart(source({ events, notes }));

		expect(chart.notes).toEqual([
			{ kind: "mine", timeMs: 250, lane: 1 },
			{ kind: "hold", lane: 2, startMs: 500, endMs: 1500 }
		]);
		expect(chart.layout.totalKeys).toBe(4);
		expect(chart.metadata.title).toBe("T");
	});
});

describe("compileChart - normalization", () => {
	it("moves the first point to t=0 when the chart starts later", () => {
		const { chart } = compileChart(source({
			events: [{ kind: "bpm", at: 3000, bpm: 150 }],
			notes: [tap(3000)]
		}));

		// the copy at 0 says the same thing as the original at 3000, so merging leaves one point
		expect(chart.timing).toEqual([
			{ timeMs: 0, bpm: 150, meter: { beats: 4, noteValue: 4 }, multiplier: 1 }
		]);
	});

	it("shifts a negative timeline up to zero and warns", () => {
		const { chart, warnings } = compileChart(source({
			events: [{ kind: "bpm", at: -500, bpm: 120 }, { kind: "bpm", at: 500, bpm: 140 }],
			notes: [tap(-500), tap(1500)]
		}));

		expect(chart.timing.map(p => p.timeMs)).toEqual([0, 1000]);
		expect(chart.notes.map(n => n.kind === "hold" ? n.startMs : n.timeMs)).toEqual([0, 2000]);
		expect(warnings.some(w => w.code === "shifted-to-zero")).toBe(true);
	});

	it("merges consecutive points that say the same thing", () => {
		const { chart } = compileChart(source({
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "sv", at: 1000, multiplier: 1 },
				{ kind: "bpm", at: 2000, bpm: 120 },
				{ kind: "bpm", at: 3000, bpm: 200 }
			],
			notes: [tap(0), tap(4000)]
		}));

		expect(chart.timing.map(p => p.timeMs)).toEqual([0, 3000]);
	});

	it("keeps the last point when several land on the same millisecond", () => {
		const { chart } = compileChart(source({
			events: [{ kind: "bpm", at: 0, bpm: 120 }, { kind: "bpm", at: 0.4, bpm: 200 }],
			notes: [tap(0), tap(1000)]
		}));

		expect(chart.timing).toHaveLength(1);
		expect(chart.timing[0]).toEqual({ timeMs: 0, bpm: 200, meter: { beats: 4, noteValue: 4 }, multiplier: 1 });
	});
});

describe("compileChart - beat axis", () => {
	it("integrates bpm to turn beats into milliseconds", () => {
		const { chart } = compileChart(source({
			timeAxis: "beat",
			events: [{ kind: "bpm", at: 0, bpm: 120 }, { kind: "bpm", at: 4, bpm: 240 }],
			notes: [tap(0), tap(4), tap(8)]
		}));

		// 120bpm -> 500ms/beat, so beat 4 is at 2000ms; 240bpm -> 250ms/beat, beat 8 at 3000ms
		expect(chart.timing.map(p => p.timeMs)).toEqual([0, 2000]);
		expect(chart.notes.map(n => n.kind === "hold" ? n.startMs : n.timeMs)).toEqual([0, 2000, 3000]);
	});

	it("converts hold ends through the same beat map", () => {
		const { chart } = compileChart(source({
			timeAxis: "beat",
			events: [{ kind: "bpm", at: 0, bpm: 120 }],
			notes: [{ kind: "hold", lane: 0, at: 2, end: 6 }]
		}));

		expect(chart.notes).toEqual([{ kind: "hold", lane: 0, startMs: 1000, endMs: 3000 }]);
	});
});

describe("compileChart - stops", () => {
	it("inserts a zero-multiplier span for a stop stated in milliseconds", () => {
		const { chart } = compileChart(source({
			timeAxis: "beat",
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "stop", at: 2, duration: { unit: "ms", value: 300 } }
			],
			notes: [tap(0), tap(2), tap(4)]
		}));

		expect(chart.timing).toEqual([
			{ timeMs: 0, bpm: 120, meter: { beats: 4, noteValue: 4 }, multiplier: 1 },
			{ timeMs: 1000, bpm: 120, meter: { beats: 4, noteValue: 4 }, multiplier: 0 },
			{ timeMs: 1300, bpm: 120, meter: { beats: 4, noteValue: 4 }, multiplier: 1 }
		]);
		// a note on the stop's own beat lands at the start of the pause
		expect(chart.notes.map(n => n.kind === "hold" ? n.startMs : n.timeMs)).toEqual([0, 1000, 2300]);
	});

	it("converts a beat-stated stop using the bpm in force at that point", () => {
		const { chart } = compileChart(source({
			timeAxis: "beat",
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "bpm", at: 2, bpm: 240 },
				{ kind: "stop", at: 2, duration: { unit: "beats", value: 1 } }
			],
			notes: [tap(0), tap(4)]
		}));

		// bpm applies before stop at the same position, so 1 beat = 250ms
		expect(chart.timing.map(p => p.timeMs)).toEqual([0, 1000, 1250]);
		expect(chart.notes.map(n => n.kind === "hold" ? n.startMs : n.timeMs)).toEqual([0, 1750]);
	});

	it("ignores stops on a millisecond-axis chart and warns", () => {
		const { chart, warnings } = compileChart(source({
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "stop", at: 1000, duration: { unit: "ms", value: 500 } }
			],
			notes: [tap(0), tap(2000)]
		}));

		expect(chart.timing.every(p => p.multiplier !== 0)).toBe(true);
		expect(warnings.some(w => w.code === "unsupported-event-on-ms-axis")).toBe(true);
	});
});

describe("compileChart - warps", () => {
	it("removes warped beats from the timeline and fakes the notes inside", () => {
		const { chart, warnings } = compileChart(source({
			timeAxis: "beat",
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "warp", at: 2, lengthBeats: 2 }
			],
			notes: [tap(0), tap(3), tap(4)]
		}));

		// beats 2..4 elapse in zero time, so beat 4 sits where beat 2 did
		expect(chart.notes).toEqual([
			{ kind: "tap", timeMs: 0, lane: 0 },
			{ kind: "fake", timeMs: 1000, lane: 0 },
			{ kind: "tap", timeMs: 1000, lane: 0 }
		]);
		expect(warnings.some(w => w.code === "warp-notes-faked")).toBe(true);
	});

	it("merges overlapping warps", () => {
		const { chart } = compileChart(source({
			timeAxis: "beat",
			events: [
				{ kind: "bpm", at: 0, bpm: 120 },
				{ kind: "warp", at: 2, lengthBeats: 2 },
				{ kind: "warp", at: 3, lengthBeats: 2 }
			],
			notes: [tap(0), tap(6)]
		}));

		// warped span is beats 2..5, so beat 6 is one beat past the warp: 1000 + 500
		expect(chart.notes.map(n => n.kind === "hold" ? n.startMs : n.timeMs)).toEqual([0, 1500]);
	});
});
