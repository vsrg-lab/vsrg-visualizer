import type { Chart } from "../../model/types";
import { formatClock } from "../format";

type ChartIdentityProps = {
	chart: Chart;
	durationMs: number;
};

/** Title, artist and the three facts that identify which chart is on screen. */
export function ChartIdentity({ chart, durationMs }: ChartIdentityProps) {
	const { totalKeys, stages } = chart.layout;
	const chips = [
		chart.metadata.version,
		stages === 2 ? `${totalKeys}K · 2 stages` : `${totalKeys}K`,
		formatClock(durationMs)
	].filter(chip => chip.length > 0);

	return (
		<div className="flex flex-col gap-1.5">
			<div className="text-[17px] font-semibold leading-[1.3] text-strong text-pretty break-words">
				{chart.metadata.title || chart.metadata.original}
			</div>
			<div className="text-[13px] text-dim break-words">{chart.metadata.artist}</div>
			<div className="flex flex-wrap gap-1.5 pt-1">
				{chips.map(chip => (
					<span
						key={chip}
						className="max-w-full rounded-[3px] bg-surface-2 px-[7px] py-[3px] font-mono text-[10px] break-all text-body/75"
					>
						{chip}
					</span>
				))}
			</div>
		</div>
	);
}
