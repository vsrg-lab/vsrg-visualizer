import { parseJudgment } from "./judgment";
import { parseLayout } from "./layout";
import { parseMetadata } from "./metadata";
import { parseNotes } from "./notes";
import { type ParseError, splitSections } from "./sections";
import { parseTiming } from "./timing";
import type { Chart } from "../../model/types";

/** outcome of parsing a URC document: a Chart, or a line-sorted list of errors. */
export type ParseResult = { ok: true; chart: Chart } | { ok: false; errors: ParseError[] };

/** Parses a full URC document into a Chart, aggregating all section errors. */
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

	const chart: Chart = {
		metadata: metadata.value,
		layout: layout.value,
		timing: timing.value,
		notes: notes.value
	};
	if (judgment && judgment.value)
		chart.judgment = judgment.value;

	return { ok: true, chart };
}

function sortByLine(errors: ParseError[]): ParseError[] {
	return [...errors].sort((a, b) => a.line - b.line);
}
