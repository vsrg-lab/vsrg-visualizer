import { describe, expect, it } from "vitest";

import { loadChart } from "./index";

const urc = [
	"@URC 1.1",
	"@Metadata",
	"Original: osu!mania",
	"Title: Song",
	"Artist: Artist",
	"Creator: Mapper",
	"Version: Normal",
	"@Layout",
	"Type: 4",
	"Special: None",
	"@Timing",
	"0, 120.0, 4/4, 1.0",
	"@Notes",
	"0, 0, N",
	"500, 1, LS",
	"1000, 1, LE"
].join("\n");

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe("loadChart", () => {
	it("loads a .urc file into a one-chart set", () => {
		const result = loadChart(bytes(urc), "song.urc");
		expect(result.ok).toBe(true);

		if (!result.ok)
			return;

		expect(result.set.sourceFormat).toBe("urc");
		expect(result.set.charts).toHaveLength(1);
		expect(result.set.charts[0].notes).toHaveLength(2);
		expect(result.set.charts[0].timing[0].timeMs).toBe(0);
	});

	it("detects urc from content when the extension is wrong", () => {
		const result = loadChart(bytes(urc), "song.txt");
		expect(result.ok).toBe(true);
	});

	it("strips a UTF-8 BOM before parsing", () => {
		const result = loadChart(bytes("﻿" + urc), "song.urc");
		expect(result.ok).toBe(true);
	});

	it("fails with a clear error on an unrecognized file", () => {
		const result = loadChart(bytes("hello world"), "song.txt");
		expect(result.ok).toBe(false);

		if (result.ok)
			return;

		expect(result.errors[0].message).toMatch(/unrecognized|unknown/i);
	});
});
