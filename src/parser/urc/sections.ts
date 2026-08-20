import type { ParseError } from "../../model/types";

/** A non-comment, non-blank source line with its 1-based number. */
export type Line = { lineNo: number; text: string };

/** A parsed '@'-section header plus its entry lines. */
export type Section = { name: string; entries: Line[] };

/** Result of splitting raw URC text into ordered sections. */
export type SplitResult =
	| { ok: true; sections: Map<string, Section> }
	| { ok: false; errors: ParseError[] };

const REQUIRED_ORDER = ["Metadata", "Layout", "Timing", "Notes"] as const;
const KNOWN_SECTIONS = new Set(["Metadata", "Judgment", "Layout", "Timing", "Notes"]);

/** Splits URC text into sections, validating the @URC header, required sections, and ordering. */
export function splitSections(text: string): SplitResult {
	const errors: ParseError[] = [];
	const sections = new Map<string, Section>();
	const order: string[] = [];

	let version = "";
	let current: Section | null = null;

	const rawLines = text.split(/\r?\n/);
	for (let i = 0; i < rawLines.length; i++) {
		const lineNo = i + 1;
		const trimmed = rawLines[i].trim();
		if (trimmed === "" || trimmed.startsWith("#"))
			continue;

		if (trimmed.startsWith("@URC")) {
			version = trimmed.slice(4).trim();
			current = null;
			continue;
		}

		if (trimmed.startsWith("@")) {
			if (version === "")
				errors.push({ line: lineNo, message: "file must begin with @URC version header" });

			const name = trimmed.slice(1).trim();
			if (!KNOWN_SECTIONS.has(name))
				errors.push({ line: lineNo, message: `unknown section @${name}` });

			current = { name, entries: [] };
			sections.set(name, current);
			order.push(name);
			continue;
		}

		if (version === "" && sections.size === 0) {
			errors.push({ line: lineNo, message: "file must begin with @URC version header" });
			continue;
		}

		if (current)
			current.entries.push({ lineNo, text: trimmed });
	}

	if (version === "")
		errors.push({ line: 1, message: "missing @URC version header" });

	for (const name of REQUIRED_ORDER)
		if (!sections.has(name))
			errors.push({ line: 1, message: `missing required section @${name}` });

	const seen = order.filter(n => (REQUIRED_ORDER as readonly string[]).includes(n));
	const expected = REQUIRED_ORDER.filter(n => seen.includes(n));
	if (seen.join(",") !== expected.join(","))
		errors.push({ line: 1, message: "sections are out of order (must be Metadata, Layout, Timing, Notes)" });

	if (errors.length > 0)
		return { ok: false, errors };

	return { ok: true, sections };
}
