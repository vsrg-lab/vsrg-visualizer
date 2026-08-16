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
