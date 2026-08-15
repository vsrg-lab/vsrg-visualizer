import type { Line, ParseError } from "./sections.ts";
import type { Meter, TimingPoint } from "../../model/types.ts";

function parseMeter(text: string): Meter | null {
	const [b, n] = text.split("/").map(s => Number(s.trim()));
	if (!Number.isInteger(b) || !Number.isInteger(n) || b <= 0 || n <= 0)
		return null;

	return { beats: b, noteValue: n };
}

/** Parses @Timing rows `ts, bpm, meter[, multiplier]`, enforcing ascending ts starting at 0 and bpm > 0. */
export function parseTiming(entries: Line[]): { value: TimingPoint[] | null; errors: ParseError[] } {
	const errors: ParseError[] = [];
	const points: TimingPoint[] = [];

	for (const entry of entries) {
		const f = entry.text.split(",").map(s => s.trim());
		if (f.length < 3 || f.length > 4) {
			errors.push({ line: entry.lineNo, message: `timing row needs 3-4 fields: "${entry.text}"` });
			continue;
		}

		const timeMs = Number(f[0]);
		const bpm = Number(f[1]);
		const meter = parseMeter(f[2]);
		const multiplier = f.length === 4 ? Number(f[3]) : 1;

		if (!Number.isInteger(timeMs) || timeMs < 0)
			errors.push({ line: entry.lineNo, message: "timing timestamp must be a non-negative integer" });

		if (!(bpm > 0))
			errors.push({ line: entry.lineNo, message: "timing bpm must be positive" });

		if (!meter)
			errors.push({ line: entry.lineNo, message: `invalid meter "${f[2]}"` });

		if (Number.isNaN(multiplier))
			errors.push({ line: entry.lineNo, message: "timing multiplier must be numeric" });
		if (meter && bpm > 0 && Number.isInteger(timeMs) && timeMs >= 0 && !Number.isNaN(multiplier))
			points.push({ timeMs, bpm, meter, multiplier });
	}

	if (points.length === 0)
		errors.push({ line: 1, message: "timing must have at least one point" });

	if (points.length > 0 && points[0].timeMs !== 0)
		errors.push({ line: 1, message: "first timing point must be at timestamp 0" });

	for (let i = 1; i < points.length; i++)
		if (points[i].timeMs <= points[i - 1].timeMs)
			errors.push({ line: 1, message: "timing timestamps must be strictly ascending" });

	if (errors.length > 0)
		return { value: null, errors };

	return { value: points, errors };
}
