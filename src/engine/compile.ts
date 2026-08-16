import type { SourceChart, TimingEvent } from "../model/source";
import type { Chart, Meter, Note, TimingPoint, Warning } from "../model/types";

/** Applied order for events sharing a position. Fixing it keeps compilation deterministic. */
const EVENT_ORDER: Record<TimingEvent["kind"], number> = { bpm: 0, meter: 1, sv: 2, warp: 3, stop: 4 };

const DEFAULT_BPM = 120;
const DEFAULT_METER: Meter = { beats: 4, noteValue: 4 };

/** A timing point before the multiplier is worked out. */
type RawPoint = { timeMs: number; bpm: number; meter: Meter; sv: number; stopped: boolean };

function sortEvents(events: TimingEvent[]): TimingEvent[] {
	return [...events].sort((a, b) => a.at - b.at || EVENT_ORDER[a.kind] - EVENT_ORDER[b.kind]);
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

/** Compiles a source chart onto the millisecond axis the engine and renderer consume. */
export function compileChart(source: SourceChart): { chart: Chart; warnings: Warning[] } {
	const warnings: Warning[] = [];
	const sorted = sortEvents(source.events);

	const points: RawPoint[] = [];
	let bpm = DEFAULT_BPM;
	let meter = DEFAULT_METER;
	let sv = 1;
	let i = 0;

	while (i < sorted.length) {
		const groupAt = sorted[i].at;

		while (i < sorted.length && sorted[i].at === groupAt) {
			const event = sorted[i];
			if (event.kind === "bpm")
				bpm = event.bpm;
			else if (event.kind === "meter")
				meter = { beats: event.beats, noteValue: event.noteValue };
			else if (event.kind === "sv")
				sv = event.multiplier;

			i++;
		}

		points.push({ timeMs: groupAt, bpm, meter, sv, stopped: false });
	}

	const notes: Note[] = source.notes.map(note => note.kind === "hold"
		? { kind: "hold", lane: note.lane, startMs: Math.round(note.at), endMs: Math.round(note.end) }
		: { kind: note.kind, lane: note.lane, timeMs: Math.round(note.at) });

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

	const chart: Chart = {
		metadata: source.metadata,
		layout: source.layout,
		timing,
		notes,
		scroll: { bpmAffectsScroll: source.bpmAffectsScroll, baseBpm }
	};

	return { chart, warnings };
}
