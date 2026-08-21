import { useEffect, useMemo, useState } from "react";

import { chartEndMs } from "./engine/duration";
import { flattenScroll } from "./engine/flatten";
import { chartStats, difficultySummary, noteDensity, timingEvents } from "./engine/stats";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import { useChartStore } from "./store/chart";
import { useSettingsStore } from "./store/settings";
import { AppShell } from "./ui/shell/AppShell";
import { EmptyState } from "./ui/shell/EmptyState";
import { Shortcuts } from "./ui/shell/Shortcuts";

/** The App. */
export function App() {
	const set = useChartStore(state => state.set);
	const errors = useChartStore(state => state.errors);
	const selected = useChartStore(state => state.selected);
	const load = useChartStore(state => state.load);

	const scrollMode = useSettingsStore(state => state.scrollMode);
	const resolvedTheme = useResolvedTheme();

	const [helpOpen, setHelpOpen] = useState(false);

	// Every derived figure is an O(notes) pass, so they are all taken once here instead of
	// per render, per key press and per effect in the components that read them.
	const loaded = useMemo(() => {
		if (!set)
			return null;

		const chart = flattenScroll(set.charts[selected], scrollMode);
		const endMs = chartEndMs(chart);
		const density = noteDensity(chart, endMs);

		return { chart, endMs, density, stats: chartStats(chart, density), events: timingEvents(chart) };
	}, [set, selected, scrollMode]);

	const summaries = useMemo(() => set?.charts.map(difficultySummary) ?? [], [set]);

	usePlaybackLoop(loaded?.endMs ?? null);

	useEffect(() => {
		document.documentElement.dataset.theme = resolvedTheme === "dark" ? "slate" : "slate-light";
	}, [resolvedTheme]);

	const content = loaded
		? (
			<AppShell
				chart={loaded.chart}
				endMs={loaded.endMs}
				density={loaded.density}
				stats={loaded.stats}
				events={loaded.events}
				summaries={summaries}
				onOpenHelp={() => setHelpOpen(true)}
			/>
		)
		: <EmptyState errors={errors} onFile={file => void load(file)} />;

	return (
		<>
			<Shortcuts endMs={loaded?.endMs ?? null} helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
			{content}
		</>
	);
}
