import { PanelLeft, PanelRight } from "lucide-react";
import { useRef } from "react";

import { ThemeToggle } from "./ThemeToggle";
import type { SourceFormat } from "../../model/types";
import { useChartStore } from "../../store/chart";
import { useSettingsStore } from "../../store/settings";
import { CHART_FILE_ACCEPT } from "../chartFiles";
import { IconButton } from "../common/IconButton";

/** Formats whose badge takes the warn tint; everything else takes the accent tint. */
const WARN_TINTED: SourceFormat[] = ["bms", "ojn"];

type AppHeaderProps = {
	/** null only in the window between a failed re-parse and the empty state taking over. */
	format: SourceFormat | null;
	fileName: string;
	onOpenHelp: () => void;
};

/** Top bar: what is loaded on the left, what the shell shows on the right. */
export function AppHeader({ format, fileName, onOpenHelp }: AppHeaderProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const load = useChartStore(state => state.load);

	const leftPanelOpen = useSettingsStore(state => state.leftPanelOpen);
	const rightPanelOpen = useSettingsStore(state => state.rightPanelOpen);
	const togglePanel = useSettingsStore(state => state.togglePanel);

	const warnTinted = format !== null && WARN_TINTED.includes(format);

	return (
		<header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-surface px-3.5">
			<div className="flex min-w-0 items-center gap-3.5">
				<span className="shrink-0 font-mono text-[12px] tracking-[0.18em] text-body/75">VSRG</span>
				<span className="h-4.5 w-px shrink-0 bg-body/12" />
				<div className="flex min-w-0 items-center gap-2">
					{format !== null && (
						<span
							className={`shrink-0 rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] tracking-widest ${
								warnTinted ? "bg-warn-soft text-warn-ui" : "bg-accent-soft text-accent-text"
							}`}
						>
							{format.toUpperCase()}
						</span>
					)}
					<span className="truncate font-mono text-[13px] text-body/85">{fileName}</span>
					<button
						type="button"
						className="shrink-0 text-[12px] text-micro transition-colors duration-120 hover:text-strong"
						onClick={() => inputRef.current?.click()}
					>
						Replace
					</button>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-1">
				<IconButton
					label={leftPanelOpen ? "Hide difficulties (1)" : "Show difficulties (1)"}
					size={28}
					active={leftPanelOpen}
					onClick={() => togglePanel("left")}
				>
					<PanelLeft size={15} strokeWidth={1.8} />
				</IconButton>
				<IconButton
					label={rightPanelOpen ? "Hide inspector (2)" : "Show inspector (2)"}
					size={28}
					active={rightPanelOpen}
					onClick={() => togglePanel("right")}
				>
					<PanelRight size={15} strokeWidth={1.8} />
				</IconButton>
				<span className="mx-1.5 h-4.5 w-px bg-body/12" />
				<ThemeToggle />
				<IconButton label="Shortcuts (?)" size={28} onClick={onOpenHelp}>
					<span className="font-mono text-[13px] leading-none">?</span>
				</IconButton>
			</div>

			<input
				ref={inputRef}
				type="file"
				accept={CHART_FILE_ACCEPT}
				className="hidden"
				onChange={e => {
					const file = e.target.files?.[0];
					if (file)
						void load(file);
				}}
			/>
		</header>
	);
}
