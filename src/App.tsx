import { useEffect, useMemo } from "react";

import { chartEndMs } from "./engine/duration";
import { flattenScroll } from "./engine/flatten";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import { useChartStore } from "./store/chart";
import { useSettingsStore } from "./store/settings";
import { DARK_MEDIA_QUERY, resolveTheme } from "./theme";
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
	const theme = useSettingsStore(state => state.theme);

	// endMs is an O(notes) pass, so it is derived once here instead of per render,
	// per key press and per effect in four different consumers.
	const loaded = useMemo(() => {
		if (!set)
			return null;

		const chart = flattenScroll(set.charts[selected], scrollMode);
		return { chart, endMs: chartEndMs(chart) };
	}, [set, selected, scrollMode]);

	usePlaybackLoop(loaded?.endMs ?? null);

	useEffect(() => {
		const media = window.matchMedia(DARK_MEDIA_QUERY);
		const apply = () => {
			const resolved = resolveTheme(theme, media.matches);
			document.documentElement.dataset.theme = resolved === "dark" ? "slate" : "slate-light";
		};

		apply();
		media.addEventListener("change", apply);

		return () => media.removeEventListener("change", apply);
	}, [theme]);

	const content = loaded
		? <AppShell chart={loaded.chart} endMs={loaded.endMs} />
		: <EmptyState errors={errors} onFile={file => void load(file)} />;

	return (
		<>
			<Shortcuts endMs={loaded?.endMs ?? null} />
			{content}
		</>
	);
}
