import type { Line } from "./sections";
import type { Metadata, ParseError } from "../../model/types.ts";

const REQUIRED = ["Original", "Title", "Artist", "Creator", "Version"] as const;

/** Parses `Key: Value` entries into Metadata, requiring all five fields with non-mempty values. */
export function parseMetadata(entries: Line[]): { value: Metadata | null; errors: ParseError[] } {
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

	for (const key of REQUIRED) {
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
