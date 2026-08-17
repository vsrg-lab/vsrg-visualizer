import { splitSections } from "./sections";
import type { Line } from "./sections";
import type { ParseResult, SourceChart, SourceNote, TimingEvent } from "../../model/source";
import type { Layout, Meter, Metadata, Note, ParseError, TimingPoint } from "../../model/types";

type OpenHold = { startMs: number; lineNo: number };

const REQUIRED_METADATA = ["Original", "Title", "Artist", "Creator", "Version"] as const;

function nums(csv: string): number[] {
	return csv.split(",").map(s => Number(s.trim()));
}

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

function parseMetadata(entries: Line[]): { value: Metadata | null; errors: ParseError[] } {
	const errors: ParseError[] = [];
	const fields = new Map<string, string>();

	for (const entry of entries) {
		const idx = entry.text.indexOf(":");
		if (idx < 0) {
			errors.push({ line: entry.lineNo, message: `metadata line must be 'Key: Value': "${entry.text}"`});
			continue;
		}

		fields.set(entry.text.slice(0, idx).trim(), entry.text.slice(idx + 1).trim());
	}

	for (const key of REQUIRED_METADATA) {
		const v = fields.get(key);
		if (v === undefined)
			errors.push({ line: 1, message: `metadata missing required field ${key}` });
		else if (v === "")
			errors.push({ line: 1, message: `metadata field ${key} must not be empty` });
	}

	if (errors.length > 0)
		return { value: null, errors };

	return {
		value: {
			original: fields.get("Original")!,
			title: fields.get("Title")!,
			artist: fields.get("Artist")!,
			creator: fields.get("Creator")!,
			version: fields.get("Version")!
		},
		errors
	};
}

function parseJudgment(entries: Line[]): { errors: ParseError[] } {
	const errors: ParseError[] = [];

	let windows: number[] | null = null;
	let rates: number[] | null = null;

	for (const entry of entries) {
		const idx = entry.text.indexOf(":");
		const key = idx < 0 ? "" : entry.text.slice(0, idx).trim();
		const rest = idx < 0 ? "": entry.text.slice(idx + 1).trim();

		if (key === "Windows")
			windows = nums(rest);
		else if (key === "Rate")
			rates = nums(rest);
		else
			errors.push({ line: entry.lineNo, message: `unexpected judgment line "${entry.text}"` });
	}

	if (!windows || !rates) {
		errors.push({ line: 1, message: "judgment requires both window and Rate lines" });
		return { errors };
	}

	if (windows.length !== rates.length)
		errors.push({ line: 1, message: "judgment Window and Rate arrays must match in length" });

	if (windows.some(Number.isNaN) || rates.some(Number.isNaN))
		errors.push({ line: 1, message: "judgment values must be numeric" });

	for (let i = 1; i < windows.length; i++) {
		if (windows[i] < windows[i - 1])
			errors.push({ line: 1, message: "judgment windows must be ascending" });
		if (rates[i] > rates[i - 1])
			errors.push({ line: 1, message: "judgment rates must be descending" });
	}

	if (rates.some(r => r < 0 || r > 100))
		errors.push({ line: 1, message: "judgment rates must be 0-100" });

	return { errors };
}

function parseLayout(entries: Line[]): { value: Layout | null; errors: ParseError[] } {
	const errors: ParseError[] = [];

	let typeText: string | null = null;
	let specialText: string | null = null;

	for (const entry of entries) {
		const idx = entry.text.indexOf(":");
		const key = idx < 0 ? "" : entry.text.slice(0, idx).trim();
		const rest = idx < 0 ? "" : entry.text.slice(idx + 1).trim();

		if (key === "Type")
			typeText = rest;
		else if (key === "Special")
			specialText = rest;
		else
			errors.push({ line: entry.lineNo, message: `unexpected layout line "${entry.text}"`});
	}

	if (typeText === null) {
		errors.push({ line: 1, message: "layout missing Type" });
		return { value: null, errors };
	}

	let normalKeys: number;
	let specialCount = 0;
	const parts = typeText.split("+").map(s => Number(s.trim()));

	if (parts.length === 1 && parts.every(Number.isInteger))
		normalKeys = parts[0];
	else if (parts.length === 2 && parts.every(Number.isInteger)) {
		normalKeys = parts[0];
		specialCount = parts[1];
	} else {
		errors.push({ line: 1, message: `invalid layout Type "${typeText}"` });
		return { value: null, errors };
	}

	const totalKeys = normalKeys + specialCount;

	let specialLanes: number[] = [];
	if (specialText !== null && specialText !== "None" && specialText !== "") {
		specialLanes = specialText.split(",").map(s => Number(s.trim()));

		if (specialLanes.some(n => !Number.isInteger(n)))
			errors.push({ line: 1, message: "Special lane indices must be integers" });
		if (specialLanes.some(n => n < 0 || n >= totalKeys))
			errors.push({ line: 1, message: `special lane index out of range (0-${totalKeys - 1})` });
		if (new Set(specialLanes).size !== specialLanes.length)
			errors.push({ line: 1, message: "duplicate special lane index" });
	}

	if (errors.length > 0)
		return { value: null, errors };

	return { value: { totalKeys, normalKeys, specialLanes, stages: 1 }, errors };
}

function parseMeter(text: string): Meter | null {
	const [b, n] = text.split("/").map(s => Number(s.trim()));
	if (!Number.isInteger(b) || !Number.isInteger(n) || b <= 0 || n <= 0)
		return null;

	return { beats: b, noteValue: n };
}

function parseTiming(entries: Line[]): { value: TimingPoint[] | null; errors: ParseError[] } {
	const errors: ParseError[] = [];
	const points: TimingPoint[] = [];

	for (const entry of entries) {
		const f = entry.text.split(",").map(s => s.trim());
		if (f.length < 3 || f.length > 4) {
			errors.push({ line: entry.lineNo, message: `timing row needs 3-4 fields: "${entry.text}"` });
			continue;
		}

		const timeMs = Number(f[0]);
		const bpm = Number(f[1]);
		const meter = parseMeter(f[2]);
		const multiplier = f.length === 4 ? Number(f[3]) : 1;

		if (!Number.isInteger(timeMs) || timeMs < 0)
			errors.push({ line: entry.lineNo, message: "timing timestamp must be a non-negative integer" });

		if (!(bpm > 0))
			errors.push({ line: entry.lineNo, message: "timing bpm must be positive" });

		if (!meter)
			errors.push({ line: entry.lineNo, message: `invalid meter "${f[2]}"` });

		if (Number.isNaN(multiplier))
			errors.push({ line: entry.lineNo, message: "timing multiplier must be numeric" });
		if (meter && bpm > 0 && Number.isInteger(timeMs) && timeMs >= 0 && !Number.isNaN(multiplier))
			points.push({ timeMs, bpm, meter, multiplier });
	}

	if (points.length === 0)
		errors.push({ line: 1, message: "timing must have at least one point" });

	if (points.length > 0 && points[0].timeMs !== 0)
		errors.push({ line: 1, message: "first timing point must be at timestamp 0" });

	for (let i = 1; i < points.length; i++)
		if (points[i].timeMs <= points[i - 1].timeMs)
			errors.push({ line: 1, message: "timing timestamps must be strictly ascending" });

	if (errors.length > 0)
		return { value: null, errors };

	return { value: points, errors };
}

function parseNotes(entries: Line[], totalKeys: number): { value: Note[] | null; errors: ParseError[] } {
	const errors: ParseError[] = [];
	const notes: Note[] = [];
	const open = new Map<number, OpenHold>();

	for (const entry of entries) {
		const f = entry.text.split(",").map(s => s.trim());
		if (f.length !== 3) {
			errors.push({ line: entry.lineNo, message: `note row needs 3 fields: "${entry.text}"` });
			continue;
		}

		const timeMs = Number(f[0]);
		const lane = Number(f[1]);
		const type = f[2];

		if (!Number.isInteger(timeMs) || timeMs < 0) {
			errors.push({ line: entry.lineNo, message: "note timestamp must be a non-negative integer" });
			continue;
		}

		if (!Number.isInteger(lane) || lane < 0 || lane >= totalKeys) {
			errors.push({ line: entry.lineNo, message: `note lane out of range (0-${totalKeys - 1})` });
			continue;
		}

		switch (type) {
			case "N":
				notes.push({ kind: "tap", timeMs, lane });
				break;
			case "M":
				notes.push({ kind: "mine", timeMs, lane });
				break;
			case "F":
				notes.push({ kind: "fake", timeMs, lane });
				break;
			case "LS":
				if (open.has(lane))
					errors.push({ line: entry.lineNo, message: `overlapping long note on lane ${lane}` });
				else
					open.set(lane, { startMs: timeMs, lineNo: entry.lineNo });
				break;
			case "LE": {
				const start = open.get(lane);
				if (!start)
					errors.push({ line: entry.lineNo, message: `unpaired LE on lane ${lane}` });
				else if (timeMs <= start.startMs) {
					errors.push({ line: entry.lineNo, message: `LE must come after its LS on lane ${lane}` });
					open.delete(lane);
				} else {
					notes.push({ kind: "hold", lane, startMs: start.startMs, endMs: timeMs });
					open.delete(lane);
				}
				break;
			}
			default:
				errors.push({ line: entry.lineNo, message: `unknown note type "${type}"` });
		}
	}

	for (const [lane, hold] of open)
		errors.push({ line: hold.lineNo, message: `unpaired LS on lane ${lane}` });

	if (errors.length > 0)
		return { value: null, errors };

	return { value: notes, errors };
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
	if (judgmentSection)
		errors.push(...parseJudgment(judgmentSection.entries).errors);

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

	return { ok: true, sources: [source] };
}

function sortByLine(errors: ParseError[]): ParseError[] {
	return [...errors].sort((a, b) => a.line - b.line);
}
