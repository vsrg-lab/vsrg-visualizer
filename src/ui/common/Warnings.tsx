import { useState } from "react";

import type { Warning } from "../../model/types";

type WarningProps = {
	warnings: Warning[];
};

/** Collapsed warning count that expands into the list. Nothing renders when the chart is clean. */
export function Warnings({ warnings }: WarningProps) {
	const [open, setOpen] = useState<boolean>(false);

	if (warnings.length === 0)
		return null;

	return (
		<div className="px-2 py-1">
			<button className="btn btn-xs btn-warning btn-outline" onClick={() => setOpen(!open)}>
				{warnings.length} warning{warnings.length !== 1 ? "s" : ""} {open ? "▲" : "▼"}
			</button>
			{open && (
				<ul className="text-warning text-xs mt-1 space-y-o.5">
					{warnings.map((w, i) => (
						<li key={i}>
							<span className="opacity-60">[{w.code}]</span> {w.message}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
