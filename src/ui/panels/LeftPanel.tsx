import { PanelSection } from "./PanelSection";
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
			className="shrink-0 h-full overflow-y-auto border-r border-base-content/10 bg-base-200 p-2"
			style={{ width: PANEL_PX }}
		>
			<div className="flex min-h-full flex-col justify-center space-y-3">
				<PanelSection title="Chart file">
					<FileDrop onFile={file => void load(file)} />
				</PanelSection>
				{charts.length > 1 && (
					<PanelSection title="Difficulty">
						<ChartSelect charts={charts} selected={selected} onSelect={select} />
					</PanelSection>
				)}
			</div>
		</aside>
	);
}
