import type { ParseError } from "../../model/types";
import { FileDrop } from "../common/FileDrop";

type EmptyStateProps = {
	errors: ParseError[];
	onFile: (file: File) => void;
};

/** Full-screen drop zone while no chart is loaded; parse errors stay visible underneath. */
export function EmptyState({ errors, onFile }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-cneter h-screen gap-4 px-8 bg-base-100 text-base-content font-sans">
			<div className="w-full max-w-xl">
				<FileDrop onFile={onFile} />
			</div>
			{errors.length > 0 && (
				<ul className="text-error text-sm">
					{errors.map((e, i) => <li key={i}>line {e.line}: {e.message}</li>)}
				</ul>
			)}
		</div>
	);
}
