import { activeEventIndex, type ChartTimingEvent } from "../../engine/stats";
import { usePlaybackStore } from "../../store/playback";
import { formatClockCentis } from "../format";

/** Label and tone of one timing row, keyed by what the event changes. */
function describe(event: ChartTimingEvent): { text: string; tone: string } {
	if (event.kind === "bpm")
		return { text: `BPM ${event.value.toFixed(2)}`, tone: "text-strong" };
	if (event.kind === "sv")
		return { text: `SV ×${event.value.toFixed(2)}`, tone: "text-accent-text" };

	return { text: `STOP ${(event.value / 1000).toFixed(2)}s`, tone: "text-warn-ui" };
}

type TimingListProps = {
	events: ChartTimingEvent[];
};

/** Every bpm, scroll-velocity and stop change, in order. Clicking a row seeks to it. */
export function TimingList({ events }: TimingListProps) {
	// Subscribing to the index rather than the time keeps this list off the per-frame path.
	const active = usePlaybackStore(state => activeEventIndex(events, state.timeMs));

	function seekTo(timeMs: number): void {
		const { playing, pause, seek } = usePlaybackStore.getState();
		if (playing)
			pause();

		seek(timeMs);
	}

	return (
		<ul className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2">
			{events.map((event, i) => {
				const { text, tone } = describe(event);

				return (
					<li key={i}>
						<button
							type="button"
							className={`flex w-full items-center gap-2.5 rounded-[5px] px-2 py-[5px] text-left font-mono text-[11px] tabular-nums transition-colors duration-[120ms] ${
								i === active ? "bg-accent-wash" : "hover:bg-hover"
							}`}
							onClick={() => seekTo(event.timeMs)}
						>
							<span className="w-13 shrink-0 text-micro">{formatClockCentis(event.timeMs)}</span>
							<span className={tone}>{text}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
