import type { Warning } from "../../model/types";

type WarningsProps = {
	warnings: Warning[];
};

/** Every warning, always expanded - a collapsed count hides exactly the thing worth reading. */
export function Warnings({ warnings }: WarningsProps) {
	return (
		<div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
			{warnings.map((warning, i) => (
				<div
					key={i}
					className="shrink-0 rounded-[5px] border-l-2 border-warn-edge bg-warn-wash px-2.25 py-1.75"
				>
					<div className="font-mono text-[10px] tracking-[0.08em] text-warn-ui">
						{warning.code.toUpperCase()}
					</div>
					<div className="text-[12px] leading-[1.4] text-body/70">
						{warning.line !== undefined && `line ${warning.line}: `}{warning.message}
					</div>
				</div>
			))}
		</div>
	);
}
