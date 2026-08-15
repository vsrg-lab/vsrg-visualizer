import type { TimingPoint } from "../model/types";

/** Maps chart time (ms) to a cumulative scroll position (scroll-units) with SV applid. */
export type ScrollModel = { positionAt(timeMs: number): number };

/**
 * Builds a scroll model where position is the time-integral of the SV multiplier.
 * 1 scroll-unit == 1ms at multiplier 1.0. Timing points must be ascending and start at 0.
 */
export function buildScrollModel(timing: TimingPoint[]): ScrollModel {
	const cumulative: number[] = new Array(timing.length).fill(0);
	for (let i = 1; i < timing.length; i++) {
		const dt = timing[i].timeMs - timing[i - 1].timeMs;
		cumulative[i] = cumulative[i - 1] + dt * timing[i - 1].multiplier;
	}

	function positionAt(timeMs: number): number {
		let i = 0;
		while (i + 1 < timing.length && timing[i + 1].timeMs <= timeMs)
			i++;

		return cumulative[i] + (timeMs - timing[i].timeMs) * timing[i].multiplier;
	}

	return { positionAt };
}

/**
 * Converts a note's scroll position to a screen y for down-scroll: notes above the
 * receptor while in the future, reaching receptorY as the playhead catches up.
 */
export function screenY(positionUnits: number, playheadUnits: number, pxPerUnit: number, receptorY: number): number {
	return receptorY - (positionUnits - playheadUnits) * pxPerUnit;
}
