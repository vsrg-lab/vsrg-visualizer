import { useEffect, useMemo, useState, type RefObject } from "react";

import type { Chart } from "../model/types";
import { useSettingsStore } from "../store/settings";

/** Reserved width of the field box. Constant across key counts and stage counts. */
const CENTER_SLOT_PX = 1080;
/** Drawn width of a single-stage field; it is centered inside the slot instead of filling it. */
const FIELD_SINGLE_PX = 520;
/** Per-lane cap - binds only at 4 keys or fewer for a single stage (520 / 5 = 104). */
const LANE_WIDTH_MAX = 120;
/** Width of the density minimap column. */
export const MINIMAP_PX = 26;
/** Gap between the field box and the minimap column. */
export const MINIMAP_GAP_PX = 10;
/** Gutter on either side of the center column. */
export const FIELD_GUTTER_PX = 24;
/** Width of the left rail. */
export const LEFT_RAIL_PX = 288;
/** Width of the right inspector. */
export const INSPECTOR_PX = 304;
/** Gap between the receptor line and the bottom edge of the canvas. */
export const RECEPTOR_OFFSET_PX = 90;

/** Width computation result; the effective fields are the panel state after auto-folding. */
type HighwayLayout = {
	laneWidth: number;
	/** Drawn width of the field canvas, stage gap included. */
	fieldPx: number;
	effectiveLeft: boolean;
	effectiveRight: boolean;
	effectiveMinimap: boolean;
};

/** Outer width the center column needs before anything folds. */
function centerNeed(withMinimap: boolean): number {
	return CENTER_SLOT_PX + (withMinimap ? MINIMAP_GAP_PX + MINIMAP_PX : 0) + FIELD_GUTTER_PX * 2;
}

/**
 * Reserves a constant center slot so switching difficulty or loading a double-play chart never
 * moves the rails, then folds the inspector, the left rail and finally the minimap when the
 * viewport cannot fit that slot. The slot is a reservation, not a drawn box: the field is sized
 * to the chart and the minimap sits directly beside it. User-closed panels never reopen.
 */
function computeHighwayLayout(
	viewportW: number,
	totalKeys: number,
	stages: 1 | 2,
	leftOpen: boolean,
	rightOpen: boolean
): HighwayLayout {
	let available = viewportW - (leftOpen ? LEFT_RAIL_PX : 0) - (rightOpen ? INSPECTOR_PX : 0);
	let effectiveLeft = leftOpen;
	let effectiveRight = rightOpen;

	if (available < centerNeed(true) && rightOpen) {
		effectiveRight = false;
		available += INSPECTOR_PX;
	}

	if (available < centerNeed(true) && leftOpen) {
		effectiveLeft = false;
		available += LEFT_RAIL_PX;
	}

	const effectiveMinimap = available >= centerNeed(true);
	const box = available
		- (effectiveMinimap ? MINIMAP_GAP_PX + MINIMAP_PX : 0)
		- FIELD_GUTTER_PX * 2;

	const slotPx = Math.max(0, Math.min(CENTER_SLOT_PX, box));
	// One lane unit is one lane; the double-stage gap is half a lane, so it adds 0.5 units.
	const laneUnits = stages === 2 ? totalKeys + 0.5 : totalKeys;
	const fieldPx = Math.min(stages === 2 ? slotPx : FIELD_SINGLE_PX, slotPx, LANE_WIDTH_MAX * laneUnits);

	return { laneWidth: fieldPx / laneUnits, fieldPx, effectiveLeft, effectiveRight, effectiveMinimap };
}

/** Layout core result plus the measured canvas box. */
export type HighwaySize = HighwayLayout & {
	receptorY: number;
	height: number;
};

/**
 * Measures the host element and feeds the box to the layout core. The host must
 * span the full panel-inclusive width; measuring the panel-excluded center
 * subtracts the panel widths twice.
 */
export function useHighwaySize(
	hostRef: RefObject<HTMLElement | null>,
	chart: Chart | null
): HighwaySize | null {
	const [box, setBox] = useState<{ width: number; height: number } | null>(null);

	const leftPanelOpen = useSettingsStore(state => state.leftPanelOpen);
	const rightPanelOpen = useSettingsStore(state => state.rightPanelOpen);

	useEffect(() => {
		const host = hostRef.current;
		if (!host)
			return;

		const observer = new ResizeObserver(entries => {
			const rect = entries[entries.length - 1].contentRect;
			setBox({ width: rect.width, height: rect.height });
		});
		observer.observe(host);

		return () => observer.disconnect();
	}, [hostRef]);

	// Identity-stable on purpose - consumers keep the result in effect deps, so
	// recomputing it per render would churn those effects.
	return useMemo<HighwaySize | null>(() => {
		if (!chart || !box)
			return null;

		const layout = computeHighwayLayout(
			box.width,
			chart.layout.totalKeys,
			chart.layout.stages,
			leftPanelOpen,
			rightPanelOpen
		);

		return { ...layout, receptorY: box.height - RECEPTOR_OFFSET_PX, height: box.height };
	}, [box, chart, leftPanelOpen, rightPanelOpen]);
}
