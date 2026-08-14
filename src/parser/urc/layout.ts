import type { Line, ParseError } from "./sections.ts";
import type { Layout } from "../../model/types.ts";

/** Parses @Layout (Type + Special) into total/normal key counts and 0-indexed special lanes. */
export function parseLayout(entries: Line[]): { value: Layout | null; errors: ParseError[] } {
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

	return { value: { totalKeys, normalKeys, specialLanes }, errors };
}