import type { ReactNode } from "react";

type PanelSectionProps = {
	title: string;
	children: ReactNode;
};

/** Labeled section used by both side panels. */
export function PanelSection({ title, children }: PanelSectionProps) {
	return (
		<section className="space-y-2">
			<h3 className="px-1 text-xs uppercase tracking-wider text-base-content/50">{title}</h3>
			{children}
		</section>
	);
}
