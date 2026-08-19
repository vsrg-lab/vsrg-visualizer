import { beforeEach, describe, expect, it } from "vitest";

import { useChartStore } from "./chart";
import { usePlaybackStore } from "./playback";

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

const randomBms = [
	"#BPM 120",
	"#RANDOM 2",
	"#IF 1",
	"#00011:01",
	"#ENDIF",
	"#IF 2",
	"#00012:01",
	"#ENDIF",
	"#ENDRANDOM"
].join("\n");

function fileOf(text: string, name: string): File {
	return new File([new TextEncoder().encode(text)], name);
}

beforeEach(() => {
	useChartStore.setState({ source: null, set: null, errors: [], selected: 0 });
});

describe("chart store", () => {
	it("loads a file into a chart set and resets selection", async () => {
		await useChartStore.getState().load(fileOf(urc, "song.urc"));
		const state = useChartStore.getState();

		expect(state.errors).toEqual([]);
		expect(state.set?.charts).toHaveLength(1);
		expect(state.source?.fileName).toBe("song.urc");
		expect(state.selected).toBe(0);
	});

	it("keeps errors and drops the set when parsing fails", async () => {
		await useChartStore.getState().load(fileOf("hello world", "song.txt"));
		const state = useChartStore.getState();

		expect(state.set).toBeNull();
		expect(state.errors.length).toBeGreaterThan(0);
		expect(state.source).toBeNull();
	});

	it("selects a difficulty and clamps the index", async () => {
		await useChartStore.getState().load(fileOf(urc, "song.urc"));
		useChartStore.getState().select(5);
		expect(useChartStore.getState().selected).toBe(0);
	});

	it("stops playback when a new file loads", async () => {
		usePlaybackStore.getState().play();
		await useChartStore.getState().load(fileOf(urc, "song.urc"));
		expect(usePlaybackStore.getState().playing).toBe(false);
	});

	it("rerolls #RANDOM branches deterministically with the injected rng", async () => {
		await useChartStore.getState().load(fileOf(randomBms, "song.bms"), () => 1);
		const first = useChartStore.getState().set?.charts[0].notes;
		useChartStore.getState().reroll();
		const second = useChartStore.getState().set?.charts[0].notes;
		expect(second).toEqual(first);
	});

	it("reroll without a source is a no-op", () => {
		useChartStore.getState().reroll();
		expect(useChartStore.getState().set).toBeNull();
	});

	it("clears everything", async () => {
		await useChartStore.getState().load(fileOf(urc, "song.urc"));
		useChartStore.getState().clear();
		const state = useChartStore.getState();

		expect(state.set).toBeNull();
		expect(state.source).toBeNull();
		expect(state.errors).toEqual([]);
		expect(state.selected).toBe(0);
	});
});
