import { FileUp } from "lucide-react";
import { useRef, type DragEvent } from "react";

import { CHART_FILE_ACCEPT } from "../chartFiles";

type FileDropProps = {
	onFile: (file: File) => void;
};

/** Drop card of the empty state. Parsing lives in the chart store so the raw bytes stay available. */
export function FileDrop({ onFile }: FileDropProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	function onDrop(e: DragEvent<HTMLDivElement>): void {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file)
			onFile(file);
	}

	return (
		<div
			onDragOver={e => e.preventDefault()}
			onDrop={onDrop}
			onClick={() => inputRef.current?.click()}
			className="flex cursor-pointer flex-col items-center gap-3 rounded-[10px] border border-dashed border-body/18 bg-surface p-8 transition-colors duration-120 hover:border-accent-ui"
		>
			<FileUp size={22} strokeWidth={1.6} className="text-body/45" />
			<div className="text-[14px] text-body/80">Drop a chart file here</div>
			<div className="flex h-8 items-center rounded-md bg-strong px-3.5 text-[13px] font-medium text-on-strong">
				Choose file
			</div>
			<input
				ref={inputRef}
				type="file"
				accept={CHART_FILE_ACCEPT}
				className="hidden"
				onClick={e => e.stopPropagation()}
				onChange={e => {
					const file = e.target.files?.[0];
					if (file)
						onFile(file);
				}}
			/>
		</div>
	);
}
