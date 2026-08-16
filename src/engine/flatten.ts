import type { Chart } from "../model/types";

/** How much of the source's scroll shaping to show. */
export type ScrollMode = "original" | "noSv";

/**
 * Rewrites only timing[].multiplier. timeMs, bpm, meter and notes are untouched, so beat lines
 * and playback position stay valid in either mode. In noSv the chart's own SV is dropped and only
 * the bpm-relative scroll remains - which also removes stops, since a stop is a zero-multiplier span.
 */
export function flattenScroll(chart: Chart, mode: ScrollMode): Chart {
	if (mode === "original")
		return chart;

	const { bpmAffectsScroll, baseBpm } = chart.scroll;

	return {
		...chart,
		timing: chart.timing.map(point => ({
			...point,
			multiplier: bpmAffectsScroll ? point.bpm / baseBpm : 1
		}))
	};
}
