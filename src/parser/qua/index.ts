import { parse } from "yaml";

import type { ParseResult, SourceChart, SourceNote, TimingEvent } from "../../model/source";
import type { Layout, Metadata, Warning } from "../../model/types";

type QuaRow = Record<string, unknown>;

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function rows(value: unknown): QuaRow[] {
	return Array.isArray(value)
		? value.filter((row): row is QuaRow => typeof row === "object" && row !== null)
		: [];
}

/** Quaver states its mode as KeysN; the scratch key, when present, sits above the normal lanes. */
function buildLayout(mode: unknown, hasScratch: boolean): Layout | null {
	const match = /^Keys(\d+)$/.exec(text(mode));
	if (!match)
		return null;

	const normalKeys = Number(match[1]);
	const totalKeys = normalKeys + (hasScratch ? 1 : 0);

	return { totalKeys, normalKeys, specialLanes: hasScratch ? [totalKeys - 1] : [], stages: 1 };
}

function buildEvents(document: QuaRow, warnings: Warning[]): TimingEvent[] {
	const events: TimingEvent[] = [];
	const points = rows(document.TimingPoints);

	for (const point of points) {
		const at = num(point.StartTime, 0);
		events.push({ kind: "bpm", at, bpm: num(point.Bpm, 120) });
		events.push({ kind: "meter", at, beats: num(point.Signature, 4), noteValue: 4 });
	}

	const initial = num(document.InitialScrollVelocity, 1);
	const firstAt = points.length > 0 ? num(points[0].StartTime, 0) : 0;
	events.push({ kind: "sv", at: firstAt, multiplier: initial });

	for (const velocity of rows(document.SliderVelocities))
		events.push({ kind: "sv", at: num(velocity.StartTime, 0), multiplier: num(velocity.Multiplier, 1) });

	if (document.TimingGroups !== undefined)
		warnings.push({
			code: "timing-groups-ignored",
			message: "custom timing groups ignored; only $Default is used"
		});

	return events;
}

function buildNotes(document: QuaRow, totalKeys: number, warnings: Warning[]): SourceNote[] {
	const notes: SourceNote[] = [];

	for (const object of rows(document.HitObjects)) {
		const at = num(object.StartTime, 0);
		const rawLane = num(object.Lane, 1) - 1;
		const lane = Math.min(Math.max(rawLane, 0), totalKeys - 1);

		if (rawLane !== lane)
			warnings.push({
				code: "lane-clamped",
				message: `hit object lane ${rawLane + 1} clamped to ${lane + 1}`
			});

		const end = num(object.EndTime, 0);
		if (end > at) {
			notes.push({ kind: "hold", lane, at, end });
			continue;
		}

		notes.push({ kind: text(object.Type) === "Mine" ? "mine" : "tap", at, lane });
	}

	return notes;
}

/** Parses a Quaver .qua document (YAML). */
export function parseQua(source: string): ParseResult {
	let document: unknown;
	try {
		document = parse(source);
	} catch (error) {
		const message = error instanceof Error ? error.message : "invalid YAML";
		return {
			ok: false,
			errors: [{
				line: 1,
				message: `could not parse .qua as YAML: ${message}`
			}]
		};
	}

	if (typeof document !== "object" || document === null)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "could not parse .qua as YAML: not a mapping"
			}]
		};

	const root = document as QuaRow;
	const warnings: Warning[] = [];
	const layout = buildLayout(root.Mode, root.HasScratchKey === true);

	if (!layout)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: `unsupported Quaver Mode "${text(root.Mode)}"`
			}]
		};

	const metadata: Metadata = {
		original: "Quaver",
		title: text(root.Title),
		artist: text(root.Artist),
		creator: text(root.Creator),
		version: text(root.DifficultyName)
	};

	const events = buildEvents(root, warnings);
	const notes = buildNotes(root, layout.totalKeys, warnings);

	if (rows(root.TimingPoints).length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "chart has no timing points"
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

	const chart: SourceChart = {
		metadata,
		layout,
		timeAxis: "ms",
		bpmAffectsScroll: root.BPMDoesNotAffectScrollVelocity !== true,
		events,
		notes
	};

	return { ok: true, sources: [chart], warnings };
}
