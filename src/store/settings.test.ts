import { beforeEach, describe, expect, it } from "vitest";

import { sanitizeSettings, useSettingsStore } from "./settings";

const state = () => useSettingsStore.getState();

beforeEach(() => {
	useSettingsStore.setState({
		theme: "system",
		scrollMode: "original",
		scrollSpeed: 0.4,
		highwayScale: 1,
		leftPanelOpen: true,
		rightPanelOpen: true
	});
});

describe("settings store", () => {
	it("holds the documented defaults", () => {
		const s = state();
		expect(s.theme).toBe("system");
		expect(s.scrollMode).toBe("original");
		expect(s.scrollSpeed).toBe(0.4);
		expect(s.highwayScale).toBe(1);
		expect(s.leftPanelOpen).toBe(true);
		expect(s.rightPanelOpen).toBe(true);
	});

	it("bumps scroll speed in clean steps and clamps at both ends", () => {
		state().bumpScrollSpeed(0.05);
		expect(state().scrollSpeed).toBe(0.45);
		state().bumpScrollSpeed(10);
		expect(state().scrollSpeed).toBe(2);
		state().bumpScrollSpeed(-10);
		expect(state().scrollSpeed).toBe(0.05);
	});

	it("clamps absolute scroll speed and highway scale", () => {
		state().setScrollSpeed(99);
		expect(state().scrollSpeed).toBe(2);
		state().setHighwayScale(0.1);
		expect(state().highwayScale).toBe(0.5);
	});

	it("toggles panels and sets the theme", () => {
		state().togglePanel("left");
		expect(state().leftPanelOpen).toBe(false);
		state().setTheme("light");
		expect(state().theme).toBe("light");
	});

	it("sanitizes unknown persisted values away", () => {
		expect(sanitizeSettings({ theme: "sepia", scrollMode: "fast", scrollSpeed: 500, highwayScale: true })).toEqual({ scrollSpeed: 2 });
	});

	it("keeps valid persisted fields and clamps the numeric ones", () => {
		expect(sanitizeSettings({ theme: "dark", scrollSpeed: 500 })).toEqual({ theme: "dark", scrollSpeed: 2 });
	});
});
