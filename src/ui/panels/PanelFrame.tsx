import type { ReactNode } from "react";

import { PANEL_PX } from "../../hooks/useHighwaySize";

type PanelFrameProps = {
	side: "left" | "right";
	children: ReactNode;
};

/** Fixed-width sidebar shell shared by both panels; only the divider side differs. */
export function PanelFrame({ side, children }: PanelFrameProps) {
	return (
		<aside
			className={`shrink-0 h-full overflow-y-auto ${side === "left" ? "border-r" : "border-l"} border-base-content/10 bg-base-200 p-2`}
			style={{ width: PANEL_PX }}
		>
			<div className="flex min-h-full flex-col justify-center space-y-3">
				{children}
			</div>
		</aside>
	);
}
