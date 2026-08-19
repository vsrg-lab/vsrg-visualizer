/** Canvas-side colors per theme. */
export type HighwayPalette = {
	background: number;
	laneSeparator: number;
	laneFill: number;
	receptor: number;
	measureLine: number;
	beatLine: number;
	tap: number;
	hold: number;
	mine: number;
	fake: number;
};

/** User-selectable theme; "system" resolves through the OS preference at runtime. */
export type ThemeChoice = "system" | "light" | "dark";

/** Dark palette. */
export const DARK_PALETTE: HighwayPalette = {
	background: 0x0e0e16,
	laneSeparator: 0x2a2a3a,
	laneFill: 0x221122,
	receptor: 0xffffff,
	measureLine: 0x666688,
	beatLine: 0x333344,
	tap: 0x66ccff,
	hold: 0x3399cc,
	mine: 0xff4444,
	fake: 0x9999aa
};

/** Light palette. */
export const LIGHT_PALETTE: HighwayPalette = {
	background: 0xf4f4f5,
	laneSeparator: 0xc9c9d2,
	laneFill: 0xe9e9ee,
	receptor: 0x18181b,
	measureLine: 0x8a8a96,
	beatLine: 0xccccd4,
	tap: 0x1e80c4,
	hold: 0x156a9c,
	mine: 0xcc3333,
	fake: 0x9c9ca6
};

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
