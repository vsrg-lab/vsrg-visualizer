import type { BeatLine } from "../model/types";

/**
 * One compiled timing span as the beat-line generator needs to see it.
 * resetsMeasure marks spans that a meter event started - only those restart the measure count.
 */
export type BeatSegment = {
	timeMs: number;
	endMs: number;
	bpm: number;
	beatsPerMeasure: number;
	resetsMeasure: boolean;
	stopped: boolean;
};

const EPSILON = 1e-6;

/**
 * Walks a continuous beat grid across the compiled spans. The phase carries over a bpm change
 * instead of restarting, a stop delays the pending beat by its own length, and the measure count
 * restarts only where the source format placed a meter event.
 *
 * A span's endMs is exclusive, so the caller gives the last span an end past endMs to let a beat
 * land exactly on the chart's final millisecond.
 */
export function generateBeatLines(segments: BeatSegment[], endMs: number): BeatLine[] {
	const lines: BeatLine[] = [];
	if (segments.length === 0)
		return lines;

	let nextBeatMs = segments[0].timeMs;
	let beatsSinceMeasure = 0;

	for (const segment of segments) {
		if (segment.resetsMeasure) {
			nextBeatMs = segment.timeMs;
			beatsSinceMeasure = 0;
		}

		if (segment.stopped) {
			nextBeatMs += segment.endMs - segment.timeMs;
			continue;
		}

		const beatMs = 60000 / segment.bpm;
		if (!(beatMs > 0))
			continue;

		const measureBeats = segment.beatsPerMeasure > 0 ? segment.beatsPerMeasure : 4;

		while (nextBeatMs < segment.endMs && nextBeatMs <= endMs) {
			lines.push({
				timeMs: Math.round(nextBeatMs),
				isMeasure: beatsSinceMeasure < EPSILON
			});
			nextBeatMs += beatMs;
			beatsSinceMeasure++;

			if (beatsSinceMeasure >= measureBeats - EPSILON)
				beatsSinceMeasure = 0;
		}
	}

	return lines;
}
