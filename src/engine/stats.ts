import { noteEndMs, noteStartMs } from "./noteTime";
import type { Chart, Note } from "../model/types";

/** Resolution of the note-density prefix sum. */
const BUCKET_MS = 100;
/** Window every "notes per second" figure is measured over. */
const NPS_WINDOW_MS = 5000;
/** Two multipliers within this distance are the same scroll velocity. */
const SV_EPSILON = 1e-6;

/** Mines and fakes are not played, so they are excluded from every count and density figure. */
function isPlayable(note: Note): boolean {
	return note.kind === "tap" || note.kind === "hold";
}

/**
 * Cumulative playable-note count over a fixed time grid. One O(notes) pass builds it; every
 * density question afterwards is answered by two array reads.
 */
export type NoteDensity = {
	/** prefix[i] is the number of playable notes starting before i * BUCKET_MS. */
	prefix: Int32Array;
};

/** Builds the density prefix sum for a compiled chart. */
export function noteDensity(chart: Chart, endMs: number): NoteDensity {
	const buckets = Math.max(1, Math.ceil(Math.max(endMs, 0) / BUCKET_MS));
	const prefix = new Int32Array(buckets + 1);

	for (const note of chart.notes) {
		if (!isPlayable(note))
			continue;

		const index = Math.min(buckets - 1, Math.max(0, Math.floor(noteStartMs(note) / BUCKET_MS)));
		prefix[index + 1]++;
	}

	for (let i = 1; i <= buckets; i++)
		prefix[i] += prefix[i - 1];

	return { prefix };
}

/** Playable notes started in [fromMs, toMs). */
function countBetween(density: NoteDensity, fromMs: number, toMs: number): number {
	const last = density.prefix.length - 1;
	const lo = Math.min(last, Math.max(0, Math.floor(fromMs / BUCKET_MS)));
	const hi = Math.min(last, Math.max(0, Math.ceil(toMs / BUCKET_MS)));

	return density.prefix[hi] - density.prefix[lo];
}

/** Notes per second in the window centered on timeMs. Cheap enough to read every frame. */
export function npsAt(density: NoteDensity, timeMs: number): number {
	const half = NPS_WINDOW_MS / 2;
	return countBetween(density, timeMs - half, timeMs + half) / (NPS_WINDOW_MS / 1000);
}

/**
 * Notes per second per minimap bar, oldest first. Bars are recomputed on resize, never per frame.
 */
export function npsBars(density: NoteDensity, endMs: number, bars: number): Float32Array {
	const out = new Float32Array(Math.max(0, bars));
	if (out.length === 0 || endMs <= 0)
		return out;

	const spanMs = endMs / out.length;
	for (let i = 0; i < out.length; i++)
		out[i] = countBetween(density, i * spanMs, (i + 1) * spanMs) / (spanMs / 1000);

	return out;
}

/** Peak notes per second over any window position. */
function peakNps(density: NoteDensity): number {
	const last = density.prefix.length - 1;
	const width = Math.max(1, Math.round(NPS_WINDOW_MS / BUCKET_MS));
	let peak = 0;

	for (let lo = 0; lo < last; lo++)
		peak = Math.max(peak, density.prefix[Math.min(last, lo + width)] - density.prefix[lo]);

	return peak / (NPS_WINDOW_MS / 1000);
}

/** Raw tallies both the inspector and the difficulty rows are built from. */
type NoteTally = {
	notes: number;
	holds: number;
	firstMs: number;
	lastMs: number;
	/** Playable notes on the 1P half; the split matches render/palette.ts. */
	leftStage: number;
	scratch: number;
};

function tallyNotes(chart: Chart): NoteTally {
	// An odd lane count gives the extra lane to 1P, exactly as the lane roles do.
	const split = Math.ceil(chart.layout.totalKeys / 2);
	const special = new Set(chart.layout.specialLanes);

	const tally: NoteTally = { notes: 0, holds: 0, firstMs: Infinity, lastMs: 0, leftStage: 0, scratch: 0 };

	for (const note of chart.notes) {
		if (!isPlayable(note))
			continue;

		tally.notes++;
		if (note.kind === "hold")
			tally.holds++;

		tally.firstMs = Math.min(tally.firstMs, noteStartMs(note));
		tally.lastMs = Math.max(tally.lastMs, noteEndMs(note));

		if (note.lane < split)
			tally.leftStage++;
		if (special.has(note.lane))
			tally.scratch++;
	}

	return tally;
}

/** Average notes per second over the span the notes actually occupy; at least one second. */
function averageNps(tally: NoteTally): number {
	if (tally.notes === 0)
		return 0;

	return tally.notes / (Math.max(tally.lastMs - tally.firstMs, 1000) / 1000);
}

/** One row of the difficulty list. Cheap enough to run over every chart in the set. */
export type DifficultySummary = { keys: number; notes: number; npsAvg: number };

/** Per-difficulty summary for the left rail. */
export function difficultySummary(chart: Chart): DifficultySummary {
	const tally = tallyNotes(chart);
	return { keys: chart.layout.totalKeys, notes: tally.notes, npsAvg: averageNps(tally) };
}

/** Everything the inspector shows that does not change with the playhead. */
export type ChartStats = {
	/** Playable notes; mines and fakes are excluded. */
	notes: number;
	holds: number;
	lnPercent: number;
	npsAvg: number;
	npsPeak: number;
	svMin: number;
	svMax: number;
	/** Playable notes per stage for double play; null for single play. */
	stageSplit: [number, number] | null;
	/** Playable notes on special (scratch) lanes for double play; null for single play. */
	scratchNotes: number | null;
};

/** The scroll velocity of a timing point with the bpm-relative part divided out. */
function svOf(multiplier: number, bpm: number, bpmAffectsScroll: boolean, baseBpm: number): number {
	const bpmPart = bpmAffectsScroll ? bpm / baseBpm : 1;
	return bpmPart === 0 ? multiplier : multiplier / bpmPart;
}

/** Derives the whole inspector summary in one pass over the notes and one over the timing. */
export function chartStats(chart: Chart, density: NoteDensity): ChartStats {
	const doubles = chart.layout.stages === 2;
	const tally = tallyNotes(chart);

	let svMin = Infinity;
	let svMax = 0;
	for (const point of chart.timing) {
		// A stop is a zero-multiplier span, not a scroll velocity of its own.
		if (point.multiplier === 0)
			continue;

		const sv = svOf(point.multiplier, point.bpm, chart.scroll.bpmAffectsScroll, chart.scroll.baseBpm);
		svMin = Math.min(svMin, sv);
		svMax = Math.max(svMax, sv);
	}

	return {
		notes: tally.notes,
		holds: tally.holds,
		lnPercent: tally.notes > 0 ? Math.round(tally.holds / tally.notes * 100) : 0,
		npsAvg: averageNps(tally),
		npsPeak: peakNps(density),
		svMin: svMin === Infinity ? 1 : svMin,
		svMax: svMax === 0 ? 1 : svMax,
		stageSplit: doubles ? [tally.leftStage, tally.notes - tally.leftStage] : null,
		scratchNotes: doubles ? tally.scratch : null
	};
}

/** What a timing row and a seek-bar flag describe. */
export type TimingEventKind = "bpm" | "sv" | "stop";

/** One entry of the flattened timing list: a bpm in bpm, an sv multiplier, or a stop in ms. */
export type ChartTimingEvent = { timeMs: number; kind: TimingEventKind; value: number };

/**
 * Flattens the compiled timing into the changes a reader cares about. Warps are absent by
 * construction: the compiler collapses them into the millisecond axis, so they leave no point behind.
 */
export function timingEvents(chart: Chart): ChartTimingEvent[] {
	const { bpmAffectsScroll, baseBpm } = chart.scroll;
	const events: ChartTimingEvent[] = [];

	let lastBpm = NaN;
	let lastSv = 1;

	for (let i = 0; i < chart.timing.length; i++) {
		const point = chart.timing[i];

		if (point.multiplier === 0) {
			const next = chart.timing[i + 1];
			events.push({ timeMs: point.timeMs, kind: "stop", value: next ? next.timeMs - point.timeMs : 0 });
			continue;
		}

		if (point.bpm !== lastBpm) {
			events.push({ timeMs: point.timeMs, kind: "bpm", value: point.bpm });
			lastBpm = point.bpm;
		}

		const sv = svOf(point.multiplier, point.bpm, bpmAffectsScroll, baseBpm);
		if (Math.abs(sv - lastSv) > SV_EPSILON) {
			events.push({ timeMs: point.timeMs, kind: "sv", value: sv });
			lastSv = sv;
		}
	}

	return events;
}

/** Index of the last event at or before timeMs, or -1 when the playhead is before all of them. */
export function activeEventIndex(events: ChartTimingEvent[], timeMs: number): number {
	let lo = 0;
	let hi = events.length - 1;
	let found = -1;

	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (events[mid].timeMs <= timeMs) {
			found = mid;
			lo = mid + 1;
		} else
			hi = mid - 1;
	}

	return found;
}
