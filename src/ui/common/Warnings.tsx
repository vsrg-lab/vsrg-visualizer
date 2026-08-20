import { ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import { useState } from "react";

import type { Warning } from "../../model/types";

type WarningsProps = {
	warnings: Warning[];
};

/** Collapsed warning count that expands into the list. Nothing renders when the chart is clean. */
export function Warnings({ warnings }: WarningsProps) {
	const [open, setOpen] = useState<boolean>(false);

	if (warnings.length === 0)
		return null;

	return (
		<div>
			<button
				type="button"
				className="btn btn-xs btn-warning btn-outline"
				onClick={() => setOpen(!open)}
			>
				<TriangleAlert size={12} />
				{warnings.length} warning{warnings.length !== 1 ? "s" : ""}
				{open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
			</button>
			{open && (
				<ul className="mt-1 space-y-0.5 text-warning text-xs">
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
