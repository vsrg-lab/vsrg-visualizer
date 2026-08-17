import { generateBeatLines, type BeatSegment } from "./beats";
import type { Duration, SourceChart, TimingEvent } from "../model/source";
import type { BeatLine, Chart, Meter, Note, TimingPoint, Warning } from "../model/types";

/** Applied order for events sharing a position. Fixing it keeps compilation deterministic. */
const EVENT_ORDER: Record<TimingEvent["kind"], number> = { bpm: 0, meter: 1, sv: 2, warp: 3, stop: 4 };

const DEFAULT_BPM = 120;
const DEFAULT_METER: Meter = { beats: 4, noteValue: 4 };

/** A timing point before the multiplier is worked out. */
type RawPoint = {
	timeMs: number;
	bpm: number;
	meter: Meter;
	sv: number;
	stopped: boolean;
	resetsMeasure: boolean;
};

function sortEvents(events: TimingEvent[]): TimingEvent[] {
	return [...events].sort((a, b) => a.at - b.at || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]);
}

function durationToMs(duration: Duration, bpm: number): number {
	return duration.unit === "ms" ? duration.value : duration.value * 60000 / bpm;
}

/** Duration-weighted most common bpm; ties go to whichever appeared first. */
function computeBaseBpm(points: RawPoint[], endMs: number): number {
	if (points.length === 0)
		return DEFAULT_BPM;

	const totals = new Map<number, number>();
	const order: number[] = [];

	for (let i = 0; i < points.length; i++) {
		const start = points[i].timeMs;
		const end = i + 1 < points.length ? points[i + 1].timeMs : Math.max(endMs, start);
		const bpm = points[i].bpm;

		if (!totals.has(bpm))
			order.push(bpm);

		totals.set(bpm, (totals.get(bpm) ?? 0) + Math.max(0, end - start));
	}

	let best = order[0];
	for (const bpm of order)
		if ((totals.get(bpm) ?? 0) > (totals.get(best) ?? 0))
			best = bpm;

	return best;
}

function noteEnd(note: Note): number {
	return note.kind === "hold" ? note.endMs : note.timeMs;
}

/** A half-open span of beats that elapses in zero time. */
type Warp = { start: number; end: number };

function collectWarps(events: TimingEvent[]): Warp[] {
	const raw: Warp[] = [];
	for (const event of events)
		if (event.kind === "warp" && event.lengthBeats > 0)
			raw.push({ start: event.at, end: event.at + event.lengthBeats });

	raw.sort((a, b) => a.start - b.start);

	const merged: Warp[] = [];
	for (const warp of raw) {
		const last = merged[merged.length - 1];
		if (last && warp.start <= last.end)
			last.end = Math.max(last.end, warp.end);
		else
			merged.push({ ...warp });
	}

	return merged;
}

/** Beats between two positions that actually take time, i.e. excluding warped spans. */
function livingBeats(warps: Warp[], from: number, to: number): number {
	let length = to - from;
	for (const warp of warps) {
		const lo = Math.max(from, warp.start);
		const hi = Math.min(to, warp.end);
		if (hi > lo)
			length -= hi - lo;
	}

	return Math.max(0, length);
}

function warpAt(warps: Warp[], at: number): Warp | null {
	for (const warp of warps)
		if (at >= warp.start && at < warp.end)
			return warp;

	return null;
}

/** Maps a source-axis position onto milliseconds. timeMsIn is before any stop at that position. */
type Mark = { at: number; timeMsIn: number; timeMsOut: number; bpm: number };

function markIndexAt(marks: Mark[], at: number): number {
	let lo = 0;
	let hi = marks.length - 1;
	let found = -1;

	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (marks[mid].at <= at) {
			found = mid;
			lo = mid + 1;
		} else
			hi = mid - 1;
	}

	return found;
}

function beatToMs(marks: Mark[], warps: Warp[], at: number): number {
	if (marks.length === 0)
		return 0;

	const index = markIndexAt(marks, at);
	if (index < 0)
		return marks[0].timeMsIn - (marks[0].at - at) * 60000 / marks[0].bpm;

	const mark = marks[index];
	if (mark.at === at)
		return mark.timeMsIn;

	return mark.timeMsOut + livingBeats(warps, mark.at, at) * 60000 / mark.bpm;
}

function shiftNote(note: Note, shift: number): Note {
	return note.kind === "hold"
		? { ...note, startMs: note.startMs + shift, endMs: note.endMs + shift }
		: { ...note, timeMs: note.timeMs + shift };
}

function samePoint(a: TimingPoint, b: TimingPoint): boolean {
	return a.bpm === b.bpm
		&& a.meter.beats === b.meter.beats
		&& a.meter.noteValue === b.meter.noteValue
		&& a.multiplier === b.multiplier;
}

/** Drops same-millisecond duplicates (last wins), guarantees a point at 0, then merges repeats. */
function normalizeTiming(timing: TimingPoint[]): TimingPoint[] {
	const deduped: TimingPoint[] = [];

	for (const point of timing)
		if (deduped.length > 0 && deduped[deduped.length - 1].timeMs === point.timeMs)
			deduped[deduped.length - 1] = point;
		else
			deduped.push(point);


	if (deduped.length === 0)
		return [{ timeMs: 0, bpm: DEFAULT_BPM, meter: DEFAULT_METER, multiplier: 1 }];

	const merged: TimingPoint[] = [deduped[0]];
	for (let i = 1; i < deduped.length; i++)
		if (!samePoint(merged[merged.length - 1], deduped[i]))
			merged.push(deduped[i]);

	return merged;
}

/** Compiles a source chart onto the millisecond axis the engine and renderer consume. */
export function compileChart(source: SourceChart): { chart: Chart; warnings: Warning[] } {
	const warnings: Warning[] = [];
	const sorted = sortEvents(source.events);

	if (source.timeAxis === "ms")
		for (const event of sorted)
			if (event.kind === "stop" || event.kind === "warp")
				warnings.push({
					code: "unsupported-event-on-ms-axis",
					message: `${event.kind} event at ${event.at} ignored on a millisecond-axis chart`
				});

	const points: RawPoint[] = [];
	const marks: Mark[] = [];
	const beatAxis = source.timeAxis === "beat";
	const warps = beatAxis ? collectWarps(sorted) : [];

	let bpm = DEFAULT_BPM;
	let meter = DEFAULT_METER;
	let sv = 1;
	let at = 0;
	let timeMs = 0;

	let i = 0;
	while (i < sorted.length) {
		const groupAt = sorted[i].at;

		if (beatAxis) {
			if (groupAt > at)
				timeMs += livingBeats(warps, at, groupAt) * 60000 / bpm;

			at = groupAt;
		} else
			timeMs = groupAt;

		let stopMs = 0;
		let hadMeter = false;

		while (i < sorted.length && sorted[i].at === groupAt) {
			const event = sorted[i];
			if (event.kind === "bpm")
				bpm = event.bpm;
			else if (event.kind === "meter") {
				meter = { beats: event.beats, noteValue: event.noteValue };
				hadMeter = true;
			} else if (event.kind === "sv")
				sv = event.multiplier;
			else if (event.kind === "stop" && beatAxis)
				stopMs += durationToMs(event.duration, bpm);

			i++;
		}

		const timeMsIn = timeMs;

		if (stopMs > 0) {
			points.push({ timeMs: timeMsIn, bpm, meter, sv, stopped: true, resetsMeasure: hadMeter });
			timeMs = timeMsIn + stopMs;
			points.push({ timeMs, bpm, meter, sv, stopped: false, resetsMeasure: hadMeter });
		} else
			points.push({ timeMs: timeMsIn, bpm, meter, sv, stopped: false, resetsMeasure: hadMeter });

		marks.push({ at: groupAt, timeMsIn, timeMsOut: timeMs, bpm });
	}

	const toMs = (position: number): number => {
		if (!beatAxis)
			return position;

		const warp = warpAt(warps, position);
		return beatToMs(marks, warps, warp ? warp.start : position);
	};

	let warpedNotes = 0;
	const notes: Note[] = source.notes.map(note => {
		const inWarp = beatAxis && warpAt(warps, note.at) !== null;
		if (inWarp)
			warpedNotes++;

		if (note.kind === "hold") {
			const startMs = Math.round(toMs(note.at));
			if (inWarp)
				return { kind: "fake", timeMs: startMs, lane: note.lane };

			return { kind: "hold", lane: note.lane, startMs, endMs: Math.round(toMs(note.end)) };
		}

		const timeMs = Math.round(toMs(note.at));
		return { kind: inWarp ? "fake" : note.kind, timeMs, lane: note.lane };
	});

	if (warpedNotes > 0)
		warnings.push({
			code: "warp-notes-faked",
			message: `${warpedNotes} note(s) inside a warp became fake`
		});

	notes.sort((a, b) => (a.kind === "hold" ? a.startMs : a.timeMs) - (b.kind === "hold" ? b.startMs : b.timeMs));

	let endMs = 0;
	for (const note of notes)
		endMs = Math.max(endMs, noteEnd(note));

	const baseBpm = computeBaseBpm(points, endMs);
	const timing: TimingPoint[] = points.map(point => ({
		timeMs: Math.round(point.timeMs),
		bpm: point.bpm,
		meter: point.meter,
		multiplier: point.stopped ? 0 : (source.bpmAffectsScroll ? point.bpm / baseBpm : 1) * point.sv
	}));

	let minMs = 0;
	for (const point of timing)
		minMs = Math.min(minMs, point.timeMs);

	for (const note of notes)
		minMs = Math.min(minMs, note.kind === "hold" ? note.startMs : note.timeMs);

	const shift = minMs < 0 ? -minMs : 0;
	let shiftedTiming = timing;
	let shiftedNotes = notes;

	if (shift > 0) {
		warnings.push({
			code: "shifted-to-zero",
			message: `timeline shifted by ${shift}ms so it starts at 0`
		});
		shiftedTiming = timing.map(point => ({ ...point, timeMs: point.timeMs + shift }));
		shiftedNotes = notes.map(note => shiftNote(note, shift));
	}

	const lineEndMs = endMs + shift;
	const segments: BeatSegment[] = points.map((point, index) => ({
		timeMs: Math.round(point.timeMs) + shift,
		endMs: index + 1 < points.length
			? Math.round(points[index + 1].timeMs) + shift
			: Math.max(lineEndMs, Math.round(point.timeMs) + shift) + 1,
		bpm: point.bpm,
		beatsPerMeasure: point.meter.beats,
		resetsMeasure: index === 0 || point.resetsMeasure,
		stopped: point.stopped
	}));

	const beatLines: BeatLine[] = generateBeatLines(segments, lineEndMs);

	const chart: Chart = {
		metadata: source.metadata,
		layout: source.layout,
		timing: normalizeTiming(shiftedTiming),
		notes: shiftedNotes,
		beatLines,
		scroll: { bpmAffectsScroll: source.bpmAffectsScroll, baseBpm }
	};

	return { chart, warnings };
}
