import type { ReactNode } from "react";

type IconButtonProps = {
	/** Accessible name; also the tooltip. */
	label: string;
	/** 28px in the header, 30px in the transport. The radius follows. */
	size: 28 | 30;
	onClick: () => void;
	/** Lit like an active label instead of the resting micro tone. */
	active?: boolean;
	children: ReactNode;
};

/** Square ghost button used for every chrome icon. Color-only hover, no layout movement. */
export function IconButton({ label, size, onClick, active, children }: IconButtonProps) {
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			onClick={onClick}
			className={`flex shrink-0 items-center justify-center transition-colors duration-120 hover:bg-hover hover:text-strong ${
				size === 28 ? "size-7 rounded-[5px]" : "size-7.5 rounded-md"
			} ${active ? "text-strong" : "text-micro"}`}
		>
			{children}
		</button>
	);
}
