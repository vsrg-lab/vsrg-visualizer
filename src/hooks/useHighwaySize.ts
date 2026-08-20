import { useEffect, useMemo, useState, type RefObject } from "react";

import type { Chart } from "../model/types";
import { useSettingsStore } from "../store/settings";

/** Base width of a single-stage highway. */
const HIGHWAY_BASE_PX = 460;
/** Per-lane cap - binds only at 3 keys or fewer (460 / 4 = 115). */
const LANE_WIDTH_MAX = 120;
/** Width one open side panel occupies. */
export const PANEL_PX = 320;
/** Gap between the receptor line and the bottom edge of the canvas. */
const RECEPTOR_OFFSET_PX = 90;

/** Width computation result; the effective fields are the panel state after auto-folding. */
type HighwayLayout = {
	laneWidth: number;
	highwayPx: number;
	effectiveLeft: boolean;
	effectiveRight: boolean;
};

/**
 * Keeps the highway width fixed across key counts - 4K and 7K get the same width,
 * only the lane width differs - and folds the right panel, then the left, when the
 * viewport cannot fit the target. User-closed panels never reopen.
 */
function computeHighwayLayout(
	viewportW: number,
	totalKeys: number,
	stages: 1 | 2,
	leftOpen: boolean,
	rightOpen: boolean
): HighwayLayout {
	const target = HIGHWAY_BASE_PX * (stages === 2 ? 2 : 1);

	let available = viewportW - (leftOpen ? PANEL_PX : 0) - (rightOpen ? PANEL_PX : 0);
	let effectiveLeft = leftOpen;
	let effectiveRight = rightOpen;

	if (available < target && rightOpen) {
		effectiveRight = false;
		available += PANEL_PX;
	}

	if (available < target && leftOpen) {
		effectiveLeft = false;
		available += PANEL_PX;
	}

	const highwayPx = Math.min(target, LANE_WIDTH_MAX * totalKeys, available);

	return { laneWidth: highwayPx / totalKeys, highwayPx, effectiveLeft, effectiveRight };
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
