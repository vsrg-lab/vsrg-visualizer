import type { Line, ParseError } from "./sections";
import type { Note } from "../../model/types";

type OpenHold = { startMs: number; lineNo: number };

/** Parses @Notes rows `ts, line,type`, validating lane range and pairing LS/LE into holds.  */
export function parseNotes(entries: Line[], totalKeys: number): { value: Note[] | null; errors: ParseError[] } {
	const errors: ParseError[] = [];
	const notes: Note[] = [];
	const open = new Map<number, OpenHold>();

	for (const entry of entries) {
		const f = entry.text.split(",").map(s => s.trim());
		if (f.length !== 3) {
			errors.push({ line: entry.lineNo, message: `note row needs 3 fields: "${entry.text}"` });
			continue;
		}

		const timeMs = Number(f[0]);
		const lane = Number(f[1]);
		const type = f[2];

		if (!Number.isInteger(timeMs) || timeMs < 0) {
			errors.push({ line: entry.lineNo, message: "note timestamp must be a non-negative integer" });
			continue;
		}

		if (!Number.isInteger(lane) || lane < 0 || lane >= totalKeys) {
			errors.push({ line: entry.lineNo, message: `note lane out of range (0-${totalKeys - 1})` });
			continue;
		}

		switch (type) {
			case "N":
				notes.push({ kind: "tap", timeMs, lane });
				break;
			case "M":
				notes.push({ kind: "mine", timeMs, lane });
				break;
			case "F":
				notes.push({ kind: "fake", timeMs, lane });
				break;
			case "LS":
				if (open.has(lane))
					errors.push({ line: entry.lineNo, message: `overlapping long note on lane ${lane}` });
				else
					open.set(lane, { startMs: timeMs, lineNo: entry.lineNo });
				break;
			case "LE": {
				const start = open.get(lane);
				if (!start)
					errors.push({ line: entry.lineNo, message: `unpaired LE on lane ${lane}` });
				else if (timeMs <= start.startMs) {
					errors.push({ line: entry.lineNo, message: `LE must come after its LS on lane ${lane}` });
					open.delete(lane);
				} else {
					notes.push({ kind: "hold", lane, startMs: start.startMs, endMs: timeMs });
					open.delete(lane);
				}
				break;
			}
			default:
				errors.push({ line: entry.lineNo, message: `unknown note type "${type}"` });
		}
	}

	for (const [lane, hold] of open)
		errors.push({ line: hold.lineNo, message: `unpaired LS on lane ${lane}` });

	if (errors.length > 0)
		return { value: null, errors };

	return { value: notes, errors };
}
