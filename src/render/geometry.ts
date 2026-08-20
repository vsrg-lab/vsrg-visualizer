import { noteStartMs } from "../engine/noteTime";
import type { Layout, Note } from "../model/types";

/** Horizontal geometry of the highway after centering and the double-stage gap. */
export type HighwayGeometry = {
	/** X of the leftmost lane edge - centers the highway in the canvas. */
	originX: number;
	/** Width of one lane. */
	laneWidth: number;
	/** Gap between the two stages; 0 for single stage. */
	stageGap: number;
	/** First lane index of the right stage; == totalKeys for the single stage. */
	stageSplit: number;
	/** Total on-screen width, stage gap included. */
	totalWidth: number;
};

/** Gap inserted between the two stages of a double-play chart; 0 for a single stage. */
export function stageGapOf(laneWidth: number, stages: 1 | 2): number {
	return stages === 2 ? laneWidth / 2 : 0;
}

/** Computes centered highway geometry; the doubled-stage gap is half a lane width. */
export function highwayGeometry(canvasWidth: number, laneWidth: number, layout: Layout): HighwayGeometry {
	const stageGap = stageGapOf(laneWidth, layout.stages);

	return {
		originX: (canvasWidth - (layout.totalKeys * laneWidth + stageGap)) / 2,
		laneWidth,
		stageGap,
		stageSplit: layout.stages === 2 ? Math.ceil(layout.totalKeys / 2) : layout.totalKeys,
		totalWidth: layout.totalKeys * laneWidth + stageGap
	};
}

/** X of a lane's left edge; lanes at or past the stage split shift by the gap. */
export function laneX(geo: HighwayGeometry, lane: number): number {
	return geo.originX + lane * geo.laneWidth + (lane >= geo.stageSplit ? geo.stageGap : 0);
}

/** First index whose note starts at or after timeMs. */
function firstIndex(notes: Note[], timeMs: number): number {
	let lo = 0;
	let hi = notes.length;

	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (noteStartMs(notes[mid]) < timeMs)
			lo = mid + 1;
		else
			hi = mid;
	}

	return lo;
}

/** Index range [start, end) of notes whose head time falls in [fromMs, toMs). */
export function visibleNoteRange(notes: Note[], fromMs: number, toMs: number): [number, number] {
	return [firstIndex(notes, fromMs), firstIndex(notes, toMs)];
}
