import type { ReactNode } from "react";

type PanelFrameProps = {
	side: "left" | "right";
	/** 288 for the difficulty rail, 304 for the inspector. */
	width: number;
	children: ReactNode;
};

/** Fixed-width rail shell shared by both sides; only the divider side and the width differ. */
export function PanelFrame({ side, width, children }: PanelFrameProps) {
	return (
		<aside
			className={`flex h-full min-h-0 shrink-0 flex-col bg-surface ${
				side === "left" ? "border-r" : "border-l"
			} border-line`}
			style={{ width }}
		>
			{children}
		</aside>
	);
}
