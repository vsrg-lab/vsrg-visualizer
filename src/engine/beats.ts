import type { TimingPoint } from "../model/types";

/** A rendered beat line; measure lines (downbeats) are drawn more prominently. */
export type BeatLine = { timeMs: number; isMeasure: boolean };

/**
 * Generate beat lines from timing points up to endMs. Within each segment, beats fall every
 * 60000/bpm ms; every meter.beats-th beat (counted from the segment start) is a measure line.
 */
export function generateBeatLines(timing: TimingPoint[], endMs: number): BeatLine[] {
	const lines: BeatLine[] = [];

	for (let i = 0; i < timing.length; i++) {
		const start = timing[i].timeMs;
		const segEnd = i + 1 < timing.length ? timing[i + 1].timeMs : endMs + 1;
		const beatMs = 60000 / timing[i].bpm;
		const beatsPerMeasure = timing[i].meter.beats;
		let beatIndex = 0;

		for (let t = start; t <= endMs && t < segEnd; t += beatMs) {
			lines.push({ timeMs: Math.round(t), isMeasure: beatIndex % beatsPerMeasure === 0 });
			beatIndex++;
		}
	}

	return lines;
}
