/** A `[Name]` block with its non-empty, non-comment lines. */
export type OsuSections = Map<string, string[]>;

/**
 * Splits an .osu document into sections.
 * [TimingPoints], [HitObjects] and [Events] hold comma-separated rows, not key/value pairs.
 */
export function splitOsuSections(text: string): OsuSections {
	const sections: OsuSections = new Map();
	let current: string[] | null = null;

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (line === "" || line.startsWith("//"))
			continue;

		if (line.startsWith("[") && line.endsWith("]")) {
			current = [];
			sections.set(line.slice(1, -1), current);
			continue;
		}

		if (current)
			current.push(line);
	}

	return sections;
}

/** Reads `Key: Value` lines from a section into a map. Later keys win. */
export function readKeyValues(lines: string[]): Map <string, string> {
	const values = new Map<string, string>();

	for (const line of lines) {
		const colon = line.indexOf(":");
		if (colon < 0)
			continue;

		values.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
	}

	return values;
}
