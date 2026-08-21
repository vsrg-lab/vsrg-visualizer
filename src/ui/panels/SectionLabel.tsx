import type { ReactNode } from "react";

type SectionLabelProps = {
	children: ReactNode;
};

/** Uppercase mono label that opens every section in both rails. */
export function SectionLabel({ children }: SectionLabelProps) {
	return <span className="font-mono text-[10px] tracking-[0.14em] text-micro">{children}</span>;
}
