import type { SourceNote } from "../../model/source";
import type { Warning } from "../../model/types";

/** StepMania note data is always four beats per measure; time signatures only move the bar lines. */
const BEATS_PER_MEASURE = 4;

/**
 * Turns a #NOTES body into notes on the beat axis. Rolls become holds and lifts become taps -
 * without judgment neither differs on screen. Keysounds produce no note.
 */
export function parseNoteData(body: string, lanes: number, warnings: Warning[]): SourceNote[] {
	const notes: SourceNote[] = [];
	const open = new Map<number, number>();
	const measures = body.split(",");

	for (let measure = 0; measure < measures.length; measure++) {
		const rows = measures[measure].split("\n").map(row => row.trim()).filter(row => row !== "");
		if (rows.length === 0)
			continue;

		for (let row = 0; row < rows.length; row++) {
			const beat = (measure + row / rows.length) * BEATS_PER_MEASURE;
			const symbols = rows[row];

			for (let lane = 0; lane < Math.min(lanes, symbols.length); lane++)
				readSymbol(symbols[lane], lane, beat, notes, open, warnings);
		}
	}

	for (const [lane, startBeat] of open) {
		warnings.push({
			code: "unclosed-hold",
			message: `hold on lane ${lane} never ends; treated as a tap`
		});
		notes.push({ kind: "tap", at: startBeat, lane });
	}

	return notes;
}

function readSymbol(
	symbol: string,
	lane: number,
	beat: number,
	notes: SourceNote[],
	open: Map<number, number>,
	warnings: Warning[]
): void {
	if (symbol === "0")
		return;

	if (symbol === "2" || symbol === "4") {
		if (open.has(lane))
			warnings.push({
				code: "overlapping-hold",
				message: `overlapping hold on lane ${lane}`
			});
		else
			open.set(lane, beat);

		return;
	}

	if (symbol === "3") {
		const startBeat = open.get(lane);
		if (startBeat === undefined) {
			warnings.push({
				code: "unpaired-hold-end",
				message: `hold end without a start on lane ${lane}`
			});
			return;
		}

		open.delete(lane);
		if (beat <= startBeat) {
			warnings.push({
				code: "zero-length-hold",
				message: `zero-length hold on lane ${lane}; treated as a tap`
			});
			notes.push({ kind: "tap", at: startBeat, lane });
			return;
		}

		notes.push({ kind: "hold", lane, at: startBeat, end: beat });
		return;
	}

	if (symbol === "M") {
		notes.push({ kind: "mine", at: beat, lane });
		return;
	}

	if (symbol === "F") {
		notes.push({ kind: "fake", at: beat, lane });
		return;
	}

	// 1 (tap), L (lift) render the same without judgment
	if (symbol === "1" || symbol === "L") {
		notes.push({ kind: "tap", at: beat, lane });
		return;
	}

	// K (keysound) marks a silent background sound trigger, not a visible note - skip it.
	if (symbol === "K")
		return;

	warnings.push({
		code: "unknown-note-symbol",
		message: `unknown note symbol "${symbol}"`
	});
}
