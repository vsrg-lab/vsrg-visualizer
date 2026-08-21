import type { ParseError } from "../../model/types";
import { CHART_FILE_GROUPS } from "../chartFiles";
import { FileDrop } from "../common/FileDrop";

type EmptyStateProps = {
	errors: ParseError[];
	onFile: (file: File) => void;
};

/** What the tool is and how to feed it, while no chart is loaded. Parse errors stay visible below. */
export function EmptyState({ errors, onFile }: EmptyStateProps) {
	return (
		<div className="flex h-screen items-center justify-center bg-base-100 px-6 font-sans text-body">
			<div className="flex w-[560px] flex-col gap-[22px]">
				<div className="flex flex-col gap-2">
					<span className="font-mono text-[10px] tracking-[0.2em] text-micro">VSRG VISUALIZER</span>
					<h1 className="text-[26px] font-semibold leading-[1.25] text-strong text-pretty">
						Load a chart and inspect its patterns
					</h1>
					<p className="text-[13px] leading-[1.6] text-dim">
						A pattern-analysis viewer with no audio and no judgment. Scroll modes, SV and BPM
						changes are shown exactly as charted.
					</p>
				</div>

				<FileDrop onFile={onFile} />

				<div className="flex flex-col gap-2.5">
					<span className="font-mono text-[10px] tracking-[0.14em] text-micro">SUPPORTED</span>
					<div className="flex flex-wrap gap-1.5">
						{CHART_FILE_GROUPS.map(group => (
							<span
								key={group}
								className="rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-body/65"
							>
								{group}
							</span>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2.5 pt-1 text-[12px] text-micro">
					<span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 font-mono text-micro">?</span>
					<span>Shortcuts · Space to play · ↑↓ scroll speed</span>
				</div>

				{errors.length > 0 && (
					<ul className="flex flex-col gap-1 text-[12px] leading-[1.5] text-error">
						{errors.map((e, i) => <li key={i}>line {e.line}: {e.message}</li>)}
					</ul>
				)}
			</div>
		</div>
	);
}
