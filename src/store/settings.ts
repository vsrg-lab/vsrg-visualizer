import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ScrollMode } from "../engine/flatten";
import type { ThemeChoice } from "../theme";

/** Scroll speed bounds - every write into the store is calmped into this range. */
export const SCROLL_SPEED_MIN = 0.05;
export const SCROLL_SPEED_MAX = 2;
/** Highway base-width multiplier bounds (1.0 = 460px). */
export const HIGHWAY_SCALE_MIN = 0.5;
export const HIGHWAY_SCALE_MAX = 2;

type PanelSide = "left" | "right";

type SettingsState = {
	theme: ThemeChoice;
	scrollMode: ScrollMode;
	scrollSpeed: number;
	highwayScale: number;
	leftPanelOpen: boolean;
	rightPanelOpen: boolean;

	setTheme: (theme: ThemeChoice) => void;
	setScrollMode: (mode: ScrollMode) => void;
	/** Step-wise change for keys and wheel; snaps to a 0.01 grid. */
	bumpScrollSpeed: (delta: number) => void;
	/** Absolute set for the range input; clamped like bump. */
	setScrollSpeed: (value: number) => void;
	setHighwayScale: (value: number) => void;
	togglePanel: (side: PanelSide) => void;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const snap = (value: number): number => Math.round(value * 100) / 100;

const clampSpeed = (value: number): number => clamp(snap(value), SCROLL_SPEED_MIN, SCROLL_SPEED_MAX);

/**
 * Validates persisted data field by field; anything unknown, wront-typed or out of range is dropped
 * so the matching default survives the merge.
 */
export function sanitizeSettings(persisted: unknown): Partial<SettingsState> {
	const raw = (persisted ?? {}) as Record<string, unknown>;
	const out: Partial<SettingsState> = {};

	if (raw.theme === "system" || raw.theme === "light" || raw.theme === "dark")
		out.theme = raw.theme;
	if (raw.scrollMode === "original" || raw.scrollMode === "noSv")
		out.scrollMode = raw.scrollMode;
	if (typeof raw.scrollSpeed === "number" && Number.isFinite(raw.scrollSpeed))
		out.scrollSpeed = clampSpeed(raw.scrollSpeed);
	if (typeof raw.highwayScale === "number" && Number.isFinite(raw.highwayScale))
		out.highwayScale = clamp(raw.highwayScale, HIGHWAY_SCALE_MIN, HIGHWAY_SCALE_MAX);
	if (typeof raw.leftPanelOpen === "boolean")
		out.leftPanelOpen = raw.leftPanelOpen;
	if (typeof raw.rightPanelOpen === "boolean")
		out.rightPanelOpen = raw.rightPanelOpen;

	return out;
}

/** User settings - changes rarely, persisted to localStorage when available. */
export const useSettingsStore = create<SettingsState>()(
	persist(
		set => ({
			theme: "system",
			scrollMode: "original",
			scrollSpeed: 0.4,
			highwayScale: 1,
			leftPanelOpen: true,
			rightPanelOpen: true,
			setTheme: theme => set({ theme }),
			setScrollMode: scrollMode => set({ scrollMode }),
			bumpScrollSpeed: delta => set(state => ({ scrollSpeed: clampSpeed(state.scrollSpeed + delta) })),
			setScrollSpeed: value => set({ scrollSpeed: clampSpeed(value) }),
			setHighwayScale: value => set({ highwayScale: clamp(value, HIGHWAY_SCALE_MIN, HIGHWAY_SCALE_MAX) }),
			togglePanel: side => set(state => side === "left"
				? { leftPanelOpen: !state.leftPanelOpen }
				: { rightPanelOpen: !state.rightPanelOpen })
		}),
		{
			name: "vsrg-visualizer-settings",
			// node(test) has no localStorage - the documented SSR-safe guard; persist then no-ops.
			storage: createJSONStorage(() => localStorage),
			merge: (persisted, current) => ({ ...current, ...sanitizeSettings(persisted)})
		}
	)
);
