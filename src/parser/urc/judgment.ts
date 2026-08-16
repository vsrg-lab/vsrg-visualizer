import type { Line } from "./sections.ts";
import type { Judgment, ParseError } from "../../model/types.ts";

function nums(csv: string): number[] {
	return csv.split(",").map(s => Number(s.trim()));
}

/** Parses the optional @Judgment section (Window/Rate arrays) with ordering and length checks. */
export function parseJudgment(entries: Line[]): { value: Judgment | null; errors: ParseError[] } {
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
		return { value: null, errors };
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

	if (errors.length > 0)
		return { value: null, errors };

	return { value: { windows, rates }, errors };
}
