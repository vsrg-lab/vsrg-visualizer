/** Canvas-side colors per theme. */
export type HighwayPalette = {
	laneSeparator: number;
	stageSeparator: number;

	/** Note colors by lane role */
	laneA: number;
	laneB: number;
	laneSpecial: number;

	/** Low-key lane background tints per role. */
	laneAFill: number;
	laneBFill: number;
	laneSpecialFill: number;

	receptor: number;
	measureLine: number;
	beatLine: number;
	mine: number;
	fake: number;
};

/** User-selectable theme; "system" resolves through the OS preference at runtime. */
export type ThemeChoice = "system" | "light" | "dark";

/** Dark palette. */
export const DARK_PALETTE: HighwayPalette = {
	laneSeparator: 0x2a2a3a,
	stageSeparator: 0x444458,
	laneA: 0xe8e8f0,
	laneB: 0x4d7dc8,
	laneSpecial: 0xd8a838,
	laneAFill: 0x181822,
	laneBFill: 0x141a28,
	laneSpecialFill: 0x201a10,
	receptor: 0xffffff,
	measureLine: 0x707090,
	beatLine: 0x2e2e40,
	mine: 0xe84848,
	fake: 0x9a9aac
};

/** Light palette. */
export const LIGHT_PALETTE: HighwayPalette = {
	laneSeparator: 0xc9c9d2,
	stageSeparator: 0xa8a8b4,
	laneA: 0x303040,
	laneB: 0x2060a8,
	laneSpecial: 0xa06818,
	laneAFill: 0xe8e8ec,
	laneBFill: 0xdfe8f4,
	laneSpecialFill: 0xf0e6d2,
	receptor: 0x18181b,
	measureLine: 0x8a8a96,
	beatLine: 0xd0d0d8,
	mine: 0xc04040,
	fake: 0x8c8c98
};

/** Darkens an RGB color by scaling each channel toward black; amount is clamped to [0, 1]. */
export function darken(color: number, amount: number): number {
	const k = 1 - Math.min(Math.max(amount, 0), 1);
	const r = Math.floor(((color >> 16) & 0xff) * k);
	const g = Math.floor(((color >> 8) & 0xff) * k);
	const b = Math.floor((color & 0xff) * k);

	return (r << 16) | (g << 8) | b;
}

/** Per-theme bundle shared by the DOM side (baseBg = DaisyUI base-100) and the canvas. */
export const THEMES: Record<"light" | "dark", { baseBg: string; highway: HighwayPalette }> = {
	dark: { baseBg: "#0e0e16", highway: DARK_PALETTE },
	light: { baseBg: "#f4f4f5", highway: LIGHT_PALETTE }
};

/** Maps a choice to a concrete theme; "system" defers to the OS preference. */
export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "light" | "dark" {
	if (choice === "system")
		return systemDark ? "dark" : "light";
	return choice;
}

/** The toggle always pins the opposite of the currently resolved theme. */
export function nextTheme(resolved: "light" | "dark"): ThemeChoice {
	return resolved === "dark" ? "light" : "dark";
}
