import { useEffect, type Dispatch, type SetStateAction } from "react";

import { useChartStore } from "../../store/chart";
import { usePlaybackStore } from "../../store/playback";
import { useSettingsStore } from "../../store/settings";
import { toggleTheme } from "../../theme";

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
	/** null while no chart is loaded - the seek keys stay inert until one is. */
	endMs: number | null;
	/** Owned by App so the header's help button opens the same overlay the "?" key does. */
	helpOpen: boolean;
	setHelpOpen: Dispatch<SetStateAction<boolean>>;
};

/**
 * Global keyboard shortcuts with a help overlay. Keys typed into a field are ignored,
 * and while the overlay is open Esc only closes it - playback stop waits.
 */
export function Shortcuts({ endMs, helpOpen, setHelpOpen }: ShortcutsProps) {
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
					if (endMs === null)
						break;

					const step = (event.shiftKey ? 1000 : 5000) * (key === "ArrowLeft" ? -1 : 1);
					playback.seek(Math.min(Math.max(playback.timeMs + step, 0), endMs));
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
					settings.setTheme(toggleTheme(settings.theme));
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
	}, [endMs, helpOpen, setHelpOpen]);

	if (!helpOpen)
		return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 font-sans"
			onClick={() => setHelpOpen(false)}
		>
			<div
				className="w-80 rounded-[10px] border border-line bg-surface p-5"
				onClick={e => e.stopPropagation()}
			>
				<div className="mb-3 font-mono text-[10px] tracking-[0.14em] text-micro">SHORTCUTS</div>
				<ul className="flex flex-col gap-2">
					{SHORTCUTS.map(([keys, description]) => (
						<li key={keys} className="flex items-center gap-3">
							<span className="w-16 shrink-0 rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[11px] text-body/75">
								{keys}
							</span>
							<span className="text-[12px] text-dim">{description}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
