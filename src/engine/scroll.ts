import type { TimingPoint } from "../model/types";

/** Maps chart time (ms) to a cumulative scroll position (scroll-units) with SV applied. */
export type ScrollModel = { positionAt(timeMs: number): number };

/** Index of the timing point active at timeMs; a time before the first point resolves to it. */
function segmentIndexAt(timing: TimingPoint[], timeMs: number): number {
	let lo = 0;
	let hi = timing.length - 1;

	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (timing[mid].timeMs <= timeMs)
			lo = mid;
		else
			hi = mid - 1;
	}

	return lo;
}

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
		const i = segmentIndexAt(timing, timeMs);
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

/** Returns the timing point active at the given time - the same segment `positionAt` resolves internally. */
export function currentTiming(timing: TimingPoint[], timeMs: number): TimingPoint {
	return timing[segmentIndexAt(timing, timeMs)];
}
