import type { Layout } from "../model/types";

/** Color role of a lane: the two alternating colors plus the special (scratch/center) color. */
export type LaneRole = "a" | "b" | "special";

/** Per-stage [start, end] lane spans; an odd double split gives the extra lane to the left stage. */
export function stageRanges(layout: Layout): [number, number][] {
	if (layout.stages === 1)
		return [[0, layout.totalKeys]];

	const left = Math.ceil(layout.totalKeys / 2);
	return [[0, left], [left, layout.totalKeys]];
}

/**
 * Maps every lane to its color role.
 */
export function laneRoles(layout: Layout): LaneRole[] {
	const roles: LaneRole[] = new Array<LaneRole>(layout.totalKeys).fill("b");

	for (const [start, end] of stageRanges(layout)) {
		const special = new Set(layout.specialLanes.filter(lane => lane >= start && lane < end));
		for (const lane of special)
			roles[lane] = "special";

		const normals: number[] = [];
		for (let lane = start; lane < end; lane++)
			if (!special.has(lane))
				normals.push(lane);

		const count = normals.length;
		const promoteCenter = special.size === 0 && count % 2 === 1;
		const center = (count - 1) / 2;

		for (let j = 0; j < count; j++) {
			if (promoteCenter && j === center) {
				roles[normals[j]] = "special";
				continue;
			}

			roles[normals[j]] = Math.ceil(Math.abs(j - center)) % 2 === 1 ? "a" : "b";
		}
	}

	return roles;
}
