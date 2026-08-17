/** One `#TAG:value:value;` directive with the line it started on. */
export type MsdTag = { lineNo: number; name: string; values: string[] };

/**
 * Reads the MSD directives that .sm and .ssc are built from. Values may span lines, `//` starts a
 * comment that runs to the end of the line, and a backslash escapes the next character.
 */
export function readMsd(text: string): MsdTag[] {
	const tags: MsdTag[] = [];
	let index = 0;
	let lineNo = 1;

	while (index < text.length) {
		const char = text[index];

		if (char === "\n") {
			lineNo++;
			index++;
			continue;
		}

		if (char === "/" && text[index + 1] === "/") {
			while (index < text.length && text[index] !== "\n")
				index++;

			continue;
		}

		if (char !== "#") {
			index++;
			continue;
		}

		const startLine = lineNo;
		const values: string[] = [];
		let current = "";
		index++;

		while (index < text.length) {
			const inner = text[index];

			if (inner === "\\" && index + 1 < text.length) {
				current += text[index + 1];
				index += 2;
				continue;
			}

			if (inner === "/" && text[index + 1] === "/") {
				while (index < text.length && text[index] !== "\n")
					index++;

				continue;
			}

			if (inner === ";") {
				index++;
				break;
			}

			if (inner === ":") {
				values.push(current);
				current = "";
				index++;
				continue;
			}

			if (inner === "\n")
				lineNo++;

			current += inner;
			index++;
		}

		values.push(current);
		const name = (values.shift() ?? "").trim().toUpperCase();
		if (name !== "")
			tags.push({ lineNo: startLine, name, values });
	}

	return tags;
}
