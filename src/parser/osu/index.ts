import { readKeyValues, splitOsuSections } from "./sections";
import type { ParseResult, SourceChart, SourceNote, TimingEvent } from "../../model/source";
import type { Layout, Metadata, Warning } from "../../model/types";

/** osu! places mania columns across a fixed 512-unit playfield. */
const PLAYFIELD_WIDTH = 512;
const HOLD_FLAG = 128;
const DOUBLE_STAGE_THRESHOLD = 10;

function num(values: Map<string, string>, key: string, fallback: number): number {
	const raw = values.get(key);
	if (raw === undefined)
		return fallback;

	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function buildLayout(totalKeys: number, specialStyle: boolean, warnings: Warning[]): Layout {
	const stages = totalKeys > DOUBLE_STAGE_THRESHOLD ? 2 : 1;
	if (stages === 2)
		warnings.push({
			code: "stages-inferred",
			message: `${totalKeys} keys: assuming a double stage (osu! files carry no co-op flag)`
		});

	const specialLanes = specialStyle ? [0] : [];

	return { totalKeys, normalKeys: totalKeys - specialLanes.length, specialLanes, stages };
}

function parseTimingPoints(lines: string[], warnings: Warning[]): TimingEvent[] {
	const events: TimingEvent[] = [];

	for (const line of lines) {
		const fields = line.split(",").map(field => field.trim());
		if (fields.length < 2) {
			warnings.push({
				code: "bad-timing-row",
				message: `skipped timing point "${line}"`
			});
			continue;
		}

		if (fields.length < 8)
			warnings.push({
				code: "short-timing-row",
				message: `timing point "${line}" is missing trailing fields`
			});

		const at = Number(fields[0]);
		const beatLength = Number(fields[1]);
		const beats = fields.length > 2 ? Number(fields[2]) : 4;
		const uninherited = fields.length > 6 ? fields[6] !== "0" : beatLength > 0;

		if (!Number.isFinite(at) || !Number.isFinite(beatLength) || beatLength === 0) {
			warnings.push({
				code: "bad-timing-row",
				message: `skipped timing point "${line}"`
			});
			continue;
		}

		if (uninherited) {
			events.push({ kind: "bpm", at, bpm: 60000 / beatLength });
			events.push({ kind: "meter", at, beats: Number.isFinite(beats) && beats > 0 ? beats : 4, noteValue: 4 });
			// an uninherited point resets scroll velocity to 1 in osu!mania
			events.push({ kind: "sv", at, multiplier: 1 });
			continue;
		}

		events.push({ kind: "sv", at, multiplier: -100 / beatLength });
	}

	return events;
}

function parseHitObjects(lines: string[], totalKeys: number, warnings: Warning[]): SourceNote[] {
	const notes: SourceNote[] = [];

	for (const line of lines) {
		const fields = line.split(",").map(field => field.trim());
		if (fields.length < 4) {
			warnings.push({
				code: "bad-hitobject-row",
				message: `skipped hit object "${line}"`
			});
			continue;
		}

		const x = Number(fields[0]);
		const at = Number(fields[2]);
		const type = Number(fields[3]);

		if (!Number.isFinite(x) || !Number.isFinite(at) || !Number.isFinite(type)) {
			warnings.push({
				code: "bad-hitobject-row",
				message: `skipped hit object "${line}"`
			});
			continue;
		}

		const raw = Math.floor(x * totalKeys / PLAYFIELD_WIDTH);
		const lane = Math.min(Math.max(raw, 0), totalKeys - 1);
		if (raw !== lane)
			warnings.push({
				code: "lane-clamped",
				message: `hit object x=${x} clamped to lane ${lane}`
			});

		if ((type & HOLD_FLAG) !== 0) {
			const end = Number((fields[5] ?? "").split(":")[0]);
			if (Number.isFinite(end) && end > at) {
				notes.push({ kind: "hold", lane, at, end });
				continue;
			}

			warnings.push({
				code: "bad-hold-end",
				message: `hold at ${at} has no usable end time; treated as a tap`
			});
		}

		notes.push({ kind: "tap", at, lane });
	}

	return notes;
}

/** Parses an osu!mania .osu document. Non-mania modes and missing headers are fatal. */
export function parseOsu(text: string): ParseResult {
	if (!text.trimStart().startsWith("osu file format v"))
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "missing \"osu file format\" header"
			}]
		};

	const warnings: Warning[] = [];
	const sections = splitOsuSections(text);

	const general = readKeyValues(sections.get("General") ?? []);
	if (num(general, "Mode", 0) !== 3)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "not an osu!mania chart (Mode must be 3)"
			}]
		};

	const difficulty = readKeyValues(sections.get("Difficulty") ?? []);
	const totalKeys = Math.round(num(difficulty, "CircleSize", 0));
	if (!(totalKeys >= 1))
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "CircleSize (key count) is missing or invalid"
			}]
		};

	const meta = readKeyValues(sections.get("Metadata") ?? []);
	const metadata: Metadata = {
		original: "osu!mania",
		title: meta.get("Title") ?? "",
		artist: meta.get("Artist") ?? "",
		creator: meta.get("Creator") ?? "",
		version: meta.get("Version") ?? ""
	};

	const layout = buildLayout(totalKeys, num(general, "SpecialStyle", 0) === 1, warnings);
	const events = parseTimingPoints(sections.get("TimingPoints") ?? [], warnings);
	const notes = parseHitObjects(sections.get("HitObjects") ?? [], totalKeys, warnings);

	if (events.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "chart has no usable timing points"
			}]
		};
	if (notes.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "chart has no notes"
			}]
		};

	const source: SourceChart = { metadata, layout, timeAxis: "ms", bpmAffectsScroll: true, events, notes };

	return { ok: true, sources: [source], warnings };
}
