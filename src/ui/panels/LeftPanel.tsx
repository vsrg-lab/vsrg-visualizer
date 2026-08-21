import { PanelFrame } from "./PanelFrame";
import { SectionLabel } from "./SectionLabel";
import type { ChartTimingEvent, DifficultySummary } from "../../engine/stats";
import { LEFT_RAIL_PX } from "../../hooks/useHighwaySize";
import { useChartStore } from "../../store/chart";
import { ChartSelect } from "../common/ChartSelect";
import { TimingList } from "../common/TimingList";

type LeftPanelProps = {
	summaries: DifficultySummary[];
	events: ChartTimingEvent[];
};

/** Left rail - "what to look at": the difficulties in the file and the chart's timing changes. */
export function LeftPanel({ summaries, events }: LeftPanelProps) {
	const charts = useChartStore(state => state.set?.charts ?? []);
	const selected = useChartStore(state => state.selected);
	const select = useChartStore(state => state.select);

	return (
		<PanelFrame side="left" width={LEFT_RAIL_PX}>
			<div className="px-3 pt-3.5 pb-2">
				<SectionLabel>DIFFICULTIES · {charts.length}</SectionLabel>
			</div>
			<ChartSelect charts={charts} summaries={summaries} selected={selected} onSelect={select} />

			<div className="px-3 pt-5 pb-2">
				<SectionLabel>TIMING EVENTS · {events.length}</SectionLabel>
			</div>
			<TimingList events={events} />
		</PanelFrame>
	);
}
