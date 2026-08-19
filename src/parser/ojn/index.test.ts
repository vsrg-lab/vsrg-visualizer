import { describe, expect, it } from "vitest";

import { buildOjn, type FixturePackage } from "./fixture";
import { parseOjn } from "./index";
import { compileChart } from "../../engine/compile";

const empty: FixturePackage[] = [];

/** Notes on one lane; types are note_type bytes and values are unique non-zero sample refs. */
function notePackage(measure: number, channel: number, types: number[]): FixturePackage {
	return {
		measure,
		channel,
		notes: types.map((type, index): [number, number, number] => [100 + index, 0, type])
	};
}

describe("parseOjn", () => {
	it("yields one source per difficulty with notes and drops empty ones", () => {
		const result = parseOjn(buildOjn({
			difficulties: [
				{ packages: empty },
				{ packages: [notePackage(0, 2, [0])] },
				{ packages: [notePackage(0, 3, [0])] }
			]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources).toHaveLength(2);
		expect(result.sources[0]!.metadata.version).toBe("Normal (lv 5)");
		expect(result.sources[1]!.metadata.version).toBe("Hard (lv 10)");
		expect(result.sources[0]!.layout).toEqual({
			totalKeys: 7,
			normalKeys: 7,
			specialLanes: [],
			stages: 1
		});
		expect(result.sources[0]!.timeAxis).toBe("beat");
		expect(result.sources[0]!.bpmAffectsScroll).toBe(true);
	});

	it("reads title, artist and noter into metadata", () => {
		const result = parseOjn(buildOjn({
			title: "Song",
			artist: "Artist",
			noter: "Noter",
			levels: [3, 7, 14],
			difficulties: [{ packages: empty }, { packages: empty }, { packages: [notePackage(0, 2, [0])] }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.metadata).toEqual({
			original: "O2Jam",
			title: "Song",
			artist: "Artist",
			creator: "Noter",
			version: "Hard (lv 14)"
		});
	});

	it("omits the level from the version when it is zero", () => {
		const result = parseOjn(buildOjn({
			levels: [0, 0, 0],
			difficulties: [{ packages: empty }, { packages: empty }, { packages: [notePackage(0, 2, [0])] }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.metadata.version).toBe("Hard");
	});

	it("fails on a broken signature, a short file, or no playable difficulty", () => {
		const broken = new Uint8Array(buildOjn());
		broken.set([0x74, 0x65, 0x73, 0x74], 4);
		expect(parseOjn(broken.buffer).ok).toBe(false);
		expect(parseOjn(new ArrayBuffer(299)).ok).toBe(false);
		expect(parseOjn(buildOjn()).ok).toBe(false);
	});

	it("scales measures by the channel 0 fraction", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [
				{ measure: 0, channel: 0, values: [0.5] },
				notePackage(1, 2, [0])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.events).toContainEqual({ kind: "meter", at: 0, beats: 2, noteValue: 4 });
		expect(result.sources[0]!.events).toContainEqual({ kind: "meter", at: 2, beats: 4, noteValue: 4 });
		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 2, lane: 0 }]);
	});

	it("turns channel 1 floats into bpm events, skipping zeros and anchoring the header bpm", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [
				{ measure: 0, channel: 1, values: [160, 0] },
				notePackage(0, 2, [0])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		const bpms = result.sources[0]!.events.filter(e => e.kind === "bpm");
		expect(bpms).toContainEqual({ kind: "bpm", at: 0, bpm: 120 });
		expect(bpms).toContainEqual({ kind: "bpm", at: 0, bpm: 160 });
		expect(bpms).toHaveLength(2);
	});

	it("spaces events at i/n of the measure", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [notePackage(0, 4, [0, 0, 0, 0])] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.notes.map(n => n.at)).toEqual([0, 1, 2, 3]);
	});

	it("ignores zero-value notes and autoplay channels", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [
				{ measure: 0, channel: 5, notes: [[0, 0, 0], [7, 0, 0]] },
				notePackage(0, 9, [0]),
				notePackage(0, 22, [0]),
				notePackage(0, 99, [0])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.notes).toEqual([{ kind: "tap", at: 2, lane: 3 }]);
	});

	it("treats every type % 4 in 0..1 as a tap, including OGG-referencing ones", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [
				notePackage(0, 2, [0, 1, 4, 5]),
				notePackage(0, 3, [6, 7])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.notes).toHaveLength(5);
		expect(result.sources[0]!.notes).toContainEqual({ kind: "hold", lane: 1, at: 0, end: 2 });
		expect(result.sources[0]!.notes.filter(n => n.kind === "tap").every(n => n.lane === 0)).toBe(true);
	});

	it("pairs long notes per lane and degrades unpaired ones", () => {
		const result = parseOjn(buildOjn({
			difficulties: [{ packages: empty }, { packages: [
				notePackage(0, 2, [2]),
				notePackage(0, 3, [3]),
				notePackage(0, 4, [2, 0, 3, 0])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.notes).toHaveLength(4);
		expect(result.sources[0]!.notes).toContainEqual({ kind: "hold", lane: 2, at: 0, end: 2 });
		expect(result.sources[0]!.notes).toContainEqual({ kind: "tap", at: 0, lane: 0 });
		expect(result.warnings?.some(w => w.code === "unpaired-ln")).toBe(true);
		expect(result.warnings?.some(w => w.code === "unpaired-ln-end")).toBe(true);
	});

	it("warns when header counts disagree with the parsed bytes", () => {
		const result = parseOjn(buildOjn({
			counts: { events: [999, 999, 999] },
			difficulties: [{ packages: empty }, { packages: [notePackage(0, 2, [0])] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.warnings?.some(w => w.code === "count-mismatch")).toBe(true);
	});

	it("stops early on a truncated section and still returns the rest", () => {
		const full = new Uint8Array(buildOjn({
			difficulties: [{ packages: empty }, { packages: empty }, { packages: [notePackage(0, 2, [0, 0, 0, 0])] }]
		}));
		const result = parseOjn(full.slice(0, full.length - 6).buffer);
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.warnings?.some(w => w.code === "truncated-section")).toBe(true);
		expect(result.sources[0]!.notes).toHaveLength(2);
	});

	it("decodes an EUC-KR title with a warning", () => {
		const result = parseOjn(buildOjn({
			titleBytes: new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]),
			difficulties: [{ packages: empty }, { packages: [notePackage(0, 2, [0])] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.sources[0]!.metadata.title).toBe("한글");
		expect(result.warnings?.some(w => w.code === "encoding-detected")).toBe(true);
	});

	it("compiles to a length consistent with the header duration", () => {
		const result = parseOjn(buildOjn({
			bpm: 120,
			durations: [0, 4, 0],
			difficulties: [{ packages: empty }, { packages: [
				notePackage(0, 2, [0]),
				notePackage(2, 2, [0])
			] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		const { chart } = compileChart(result.sources[0]!);
		const lastMs = Math.max(...chart.notes.map(n => n.kind === "hold" ? n.endMs : n.timeMs));
		expect(Math.abs(lastMs / 1000 - 4)).toBeLessThan(2);
	});

	it("warns on an unusual encode version", () => {
		const result = parseOjn(buildOjn({
			encodeVersion: 999,
			difficulties: [{ packages: empty }, { packages: [notePackage(0, 2, [0])] }, { packages: empty }]
		}));
		expect(result.ok).toBe(true);
		if (!result.ok)
			return;

		expect(result.warnings?.some(w => w.code === "encode-version-unusual")).toBe(true);
	});
});
