import { describe, expect, it } from "vitest";

import { DARK_PALETTE, THEMES, nextTheme, resolveTheme } from "./theme";

describe("resolveTheme", () => {
	it("follows the system preference when the choice is system", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});

	it("keeps an explicit choice regardless of the system", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
});

describe("nextTheme", () => {
	it("pins the opposite of the resolved theme", () => {
		expect(nextTheme("dark")).toBe("light");
		expect(nextTheme("light")).toBe("dark");
	});
});

describe("THEMES", () => {
	it("gives each theme a distinct valid hex background", () => {
		expect(THEMES.dark.baseBg).not.toBe(THEMES.light.baseBg);
		for (const theme of Object.values(THEMES))
			expect(theme.baseBg).toMatch(/^#[0-9a-f]{6}$/);
	});

	it("gives every theme a complete finite highway palette", () => {
		for (const palette of [THEMES.dark.highway, THEMES.light.highway])
			for (const value of Object.values(palette))
				expect(typeof value === "number" && Number.isFinite(value)).toBe(true);
	});

	it("documents the dark palette with the current renderer values", () => {
		expect(DARK_PALETTE.tap).toBe(0x66ccff);
		expect(DARK_PALETTE.background).toBe(0x0e0e16);
	});
});
