import { readHeader } from "./header";
import { readNoteSection } from "./notes";
import type { ParseResult, SourceChart } from "../../model/source";
import type { Warning } from "../../model/types";

/** Display names of the three difficulty slots, in header order. */
const DIFFICULTY_NAMES = ["Easy", "Normal", "Hard"];

/** "Hard (lv 14)" for a positive level, just "Hard" otherwise. */
function versionOf(name: string, level: number): string {
	return level > 0 ? `${name} (lv ${level})` : name;
}

/** One header-count comparison; a disagreement is a warning, never a failure. */
function crossCheck(warnings: Warning[], what: string, actual: number, expected: number, difficulty: number): void {
	if (actual !== expected)
		warnings.push({
			code: "count-mismatch",
			message: `difficulty ${difficulty} ${what}: header says ${expected}, parsed ${actual}`
		});
}

/**
 * Parses an O2Jam .ojn binary into one source chart per playable difficulty.
 * Header counts are cross-checked against what was actually read; a mismatch becomes a warning, never a failure.
 */
export function parseOjn(bytes: ArrayBuffer): ParseResult {
	const header = readHeader(bytes);
	if (!header.ok)
		return { ok: false, errors: [header.error] };

	const warnings: Warning[] = [...header.warnings];
	const view = new DataView(bytes);
	const sources: SourceChart[] = [];

	for (let d = 0; d < 3; d++) {
		if (header.header.noteCount[d] === 0)
			continue;

		const start = header.header.noteOffset[d]!;
		const next = d < 2 ? header.header.noteOffset[d + 1]! : header.header.coverOffset;
		const end = Math.min(next > start ? next : bytes.byteLength, bytes.byteLength);
		const section = readNoteSection(view, start, end, warnings);

		sources.push({
			metadata: {
				original: "O2Jam",
				title: header.header.title,
				artist: header.header.artist,
				creator: header.header.noter,
				version: versionOf(DIFFICULTY_NAMES[d]!, header.header.level[d]!)
			},
			layout: { totalKeys: 7, normalKeys: 7, specialLanes: [], stages: 1 },
			timeAxis: "beat",
			bpmAffectsScroll: true,
			events: [{ kind: "bpm", at: 0, bpm: header.header.bpm }, ...section.events],
			notes: section.notes
		});

		crossCheck(warnings, "packages", section.counts.packages, header.header.packageCount[d]!, d);
		crossCheck(warnings, "events", section.counts.events, header.header.eventCount[d]!, d);
		crossCheck(warnings, "notes", section.counts.notes, header.header.noteCount[d]!, d);
		crossCheck(warnings, "measures", section.counts.measures, header.header.measureCount[d]!, d);
	}

	if (sources.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "no playable difficulty in this file"
			}]
		};

	return { ok: true, sources, warnings };
}
