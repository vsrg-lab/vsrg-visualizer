import { useEffect, useMemo } from "react";

import { flattenScroll } from "./engine/flatten";
import { usePlaybackLoop } from "./hooks/usePlaybackLoop";
import { useChartStore } from "./store/chart";
import { useSettingsStore } from "./store/settings";
import { resolveTheme } from "./theme";
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

	const chart = useMemo(
		() => set ? flattenScroll(set.charts[selected], scrollMode) : null,
		[set, selected, scrollMode]
	);

	usePlaybackLoop(chart);

	useEffect(() => {
		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const apply = () => {
			const resolved = resolveTheme(theme, media.matches);
			document.documentElement.dataset.theme = resolved === "dark" ? "slate" : "slate-light";
		};

		apply();
		media.addEventListener("change", apply);

		return () => media.removeEventListener("change", apply);
	}, [theme]);

	const content = chart
		? <AppShell chart={chart} />
		: <EmptyState errors={errors} onFile={file => void load(file)} />;

	return (
		<>
			<Shortcuts chart={chart} />
			{content}
		</>
	);
}
