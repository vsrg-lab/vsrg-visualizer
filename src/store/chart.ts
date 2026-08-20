import { create } from "zustand";

import { usePlaybackStore } from "./playback";
import type { ChartSet, ParseError } from "../model/types";
import { loadChart } from "../parser";
import type { Rng } from "../parser/bms/preprocess";

/** File-backed chart source, kept so #RANDOM charts can be re-parsed. */
type ChartSource = { bytes: ArrayBuffer; fileName: string };

type ChartState = {
	source: ChartSource | null;
	set: ChartSet | null;
	errors: ParseError[];
	selected: number;

	load: (file: File, rng?: Rng) => Promise<void>;
	select: (index: number) => void;
	/** Re-parses the loaded file, reusing the rng of the last load so a fixed rng stays deterministic. */
	reroll: () => void;
};

/** The rng of the last load - reroll reuses it. */
let lastRng: Rng | undefined;

function applyLoad(result: ReturnType<typeof loadChart>): Partial<ChartState> {
	if (result.ok)
		return { set: result.set, errors: [], selected: 0 };
	return { set: null, errors: result.errors, selected: 0 };
}

/** Chart state - one update per file load, so it is not persisted. */
export const useChartStore = create<ChartState>()((set, get) => ({
	source: null,
	set: null,
	errors: [],
	selected: 0,
	load: async (file, rng) => {
		const bytes = await file.arrayBuffer();
		lastRng = rng;
		usePlaybackStore.getState().stop();

		const result = loadChart(bytes, file.name, rng ? { rng } : undefined);
		set({ ...applyLoad(result), source: result.ok ? { bytes, fileName: file.name } : null });
	},
	select: index => {
		const charts = get().set?.charts;
		if (!charts || charts.length === 0)
			return;

		set({ selected: Math.min(Math.max(index, 0), charts.length - 1) });
	},
	reroll: () => {
		const source = get().source;
		if (!source)
			return;

		usePlaybackStore.getState().stop();

		const result = loadChart(source.bytes, source.fileName, lastRng ? { rng: lastRng } : undefined);
		set(applyLoad(result));
	}
}));
