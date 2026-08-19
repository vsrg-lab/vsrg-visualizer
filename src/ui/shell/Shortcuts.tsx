import { useEffect, useState } from "react";

import { chartEndMs } from "../../engine/duration";
import type { Chart } from "../../model/types";
import { useChartStore } from "../../store/chart";
import { usePlaybackStore } from "../../store/playback";
import { useSettingsStore } from "../../store/settings";
import { nextTheme, resolveTheme } from "../../theme";

/** Help overlay rows; keep in sync with the switch below. */
const SHORTCUTS: [string, string][] = [
	["Space", "Play / pause"],
	["Esc", "Stop (back to the start)"],
	["← →", "Seek 5s (1s with Shift)"],
	["↑ ↓", "Scroll speed +/- 0.05"],
	["[ ]", "Previous / next difficulty"],
	["S", "Toggle scroll mode"],
	["T", "Toggle theme"],
	["1 2", "Toggle left / right panel"],
	["?", "Toggle this help"]
];

type ShortcutsProps = {
	chart: Chart | null;
};

/**
 * Global keyboard shortcuts with a help overlay. Keys typed into a field are ignored,
 * and while the overlay is open Esc only closes it - playback stop waits.
 */
export function Shortcuts({ chart }: ShortcutsProps) {
	const [helpOpen, setHelpOpen] = useState(false);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLElement
				&& (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA" || target.isContentEditable)
			)
				return;

			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

			if (helpOpen) {
				if (key === "Escape" || key === "?") {
					event.preventDefault();
					setHelpOpen(false);
				}

				return;
			}

			const playback = usePlaybackStore.getState();
			const settings = useSettingsStore.getState();
			const charts = useChartStore.getState();

			switch (key) {
				case " ":
					event.preventDefault();
					if (playback.playing)
						playback.pause();
					else
						playback.play();
					break;
				case "Escape":
					event.preventDefault();
					playback.stop();
					break;
				case "ArrowLeft":
				case "ArrowRight": {
					event.preventDefault();
					const step = (event.shiftKey ? 1000 : 5000) * (key === "ArrowLeft" ? -1 : 1);
					playback.seek(Math.min(Math.max(playback.timeMs + step, 0), chartEndMs(chart!)));
					break;
				}
				case "ArrowUp":
					event.preventDefault();
					settings.bumpScrollSpeed(0.05);
					break;
				case "ArrowDown":
					event.preventDefault();
					settings.bumpScrollSpeed(-0.05);
					break;
				case "[":
					charts.select(charts.selected - 1);
					break;
				case "]":
					charts.select(charts.selected + 1);
					break;
				case "s":
					settings.setScrollMode(settings.scrollMode === "original" ? "noSv" : "original");
					break;
				case "t": {
					const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
					settings.setTheme(nextTheme(resolveTheme(settings.theme, systemDark)));
					break;
				}
				case "1":
					settings.togglePanel("left");
					break;
				case "2":
					settings.togglePanel("right");
					break;
				case "?":
					event.preventDefault();
					setHelpOpen(true);
					break;
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [chart, helpOpen]);

	if (!helpOpen)
		return null;

	return (
		<div className="modal modal-open" onClick={() => setHelpOpen(false)}>
			<div className="modal-box" onClick={e => e.stopPropagation()}>
				<div className="text-lg font-bold mb-2">Shortcuts</div>
				<table className="table table-sm">
					<tbody>
						{SHORTCUTS.map(([keys, description]) => (
							<tr key={keys}>
								<td className="w-24"><span className="kbd kbd-sm">{keys}</span></td>
								<td>{description}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
