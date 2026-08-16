import { parseJudgment } from "./judgment";
import { parseLayout } from "./layout";
import { parseMetadata } from "./metadata";
import { parseNotes } from "./notes";
import { splitSections } from "./sections";
import { parseTiming } from "./timing";
import type { SourceChart, SourceNote, TimingEvent } from "../../model/source";
import type { Note, ParseError, TimingPoint } from "../../model/types";

/** outcome of parsing a URC document: a Chart, or a line-sorted list of errors. */
export type ParseResult = { ok: true; source: SourceChart } | { ok: false; errors: ParseError[] };

/** URC states timing on the millisecond axis with an explicit multiplier, so each row becomes three events. */
function toEvents(points: TimingPoint[]): TimingEvent[] {
	const events: TimingEvent[] = [];
	for (const point of points) {
		events.push({ kind: "bpm", at: point.timeMs, bpm: point.bpm });
		events.push({ kind: "meter", at: point.timeMs, beats: point.meter.beats, noteValue: point.meter.noteValue });
		events.push({ kind: "sv", at: point.timeMs, multiplier: point.multiplier });
	}

	return events;
}

function toSourceNotes(notes: Note[]): SourceNote[] {
	return notes.map(note => note.kind === "hold"
		? { kind: "hold", lane: note.lane, at: note.startMs, end: note.endMs }
		: { kind: note.kind, lane: note.lane, at: note.timeMs });
}

/** Parses a full URC document into a SourceChart, aggregating all section errors. */
export function parseUrc(text: string): ParseResult {
	const split = splitSections(text);
	if (!split.ok)
		return { ok: false, errors: sortByLine(split.errors) };

	const errors: ParseError[] = [];
	const sections = split.sections;

	const metadata = parseMetadata(sections.get("Metadata")!.entries);
	errors.push(...metadata.errors);

	const layout = parseLayout(sections.get("Layout")!.entries);
	errors.push(...layout.errors);

	const timing = parseTiming(sections.get("Timing")!.entries);
	errors.push(...timing.errors);

	const totalKeys = layout.value ? layout.value.totalKeys : Number.POSITIVE_INFINITY;
	const notes = parseNotes(sections.get("Notes")!.entries, totalKeys);
	errors.push(...notes.errors);

	const judgmentSection = sections.get("Judgment");
	const judgment = judgmentSection ? parseJudgment(judgmentSection!.entries) : null;
	if (judgment)
		errors.push(...judgment.errors);

	if (errors.length > 0 || !metadata.value || !layout.value || !timing.value || !notes.value)
		return { ok: false, errors: sortByLine(errors) };

	const source: SourceChart = {
		metadata: metadata.value,
		layout: layout.value,
		timeAxis: "ms",
		bpmAffectsScroll: false,
		events: toEvents(timing.value),
		notes: toSourceNotes(notes.value)
	};

	return { ok: true, source };
}

function sortByLine(errors: ParseError[]): ParseError[] {
	return [...errors].sort((a, b) => a.line - b.line);
}
