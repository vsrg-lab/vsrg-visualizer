import { noteEndMs } from "./noteTime";
import type { Chart } from "../model/types";

const END_PADDING_MS = 5000;

/** Last note's end time plus a fixed padding - no supported format declares an explicit song length. */
export function chartEndMs(chart: Chart): number {
	let end = 0;
	for (const note of chart.notes)
		end = Math.max(end, noteEndMs(note));

	return end + END_PADDING_MS;
}
