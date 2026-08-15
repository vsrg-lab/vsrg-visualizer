import type { Chart } from "../model/types";

const END_PADDING_MS = 5000;

/** Last note's end time (holds use endMs) plus a fixed padding - URC never declares an explicit song length. */
export function chartEndMs(chart: Chart): number {
	let end = 0;
	for (const n of chart.notes)
		end = Math.max(end, n.kind === "hold" ? n.endMs : n.timeMs);
	return end + END_PADDING_MS;
}
