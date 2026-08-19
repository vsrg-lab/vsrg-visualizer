import { PANEL_PX } from "../../hooks/useHighwaySize";
import { useChartStore } from "../../store/chart";
import { ChartSelect } from "../common/ChartSelect";
import { FileDrop } from "../common/FileDrop";

/** Left sidebar - "what to look at": the loaded file and its difficulty list. */
export function LeftPanel() {
	const charts = useChartStore(state => state.set?.charts ?? []);
	const load = useChartStore(state => state.load);
	const selected = useChartStore(state => state.selected);
	const select = useChartStore(state => state.select);

	return (
		<aside
			className="shrink-0 h-full overflow-y-auto border-r border-base-content/10 p-2 space-y-2"
			style={{ width: PANEL_PX }}
		>
			<FileDrop onFile={file => void load(file)} />
			<ChartSelect charts={charts} selected={selected} onSelect={select} />
		</aside>
	);
}
