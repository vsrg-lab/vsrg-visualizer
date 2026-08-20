import { FileUp } from "lucide-react";
import { useRef, type DragEvent } from "react";

type FileDropProps = {
	onFile: (file: File) => void;
};

/** File picker + drag-drop zone. Parsing lives in the chart so the raw bytes stay available for re-parsing. */
export function FileDrop({ onFile }: FileDropProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	function onDrop(e: DragEvent<HTMLDivElement>): void {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file)
			onFile(file);
	}

	return (
		<div>
			<div
				onDragOver={e => e.preventDefault()}
				onDrop={onDrop}
				onClick={() => inputRef.current?.click()}
				className="rounded-box border-2 border-dashed border-base-300 p-3 text-center text-base-content/70 transition-colors cursor-pointer hover:border-base-content/40"
			>
				<FileUp size={20} className="mx-auto mb-1 opacity-60" />
				<div className="text-sm">Drop a chart file here, or click to choose</div>
				<div className="text-xs opacity-60">.urc · .osu · .qua · .sm/.ssc · .bms/.bme/.bml/.pms · .ojn</div>
			</div>
			<input
				ref={inputRef}
				type="file"
				accept=".urc,.osu,.qua,.sm,.ssc,.bms,.bme,.bml,.pms,.ojn"
				className="hidden"
				onChange={e => {
					const file = e.target.files?.[0];
					if (file)
						onFile(file);
				}}
			/>
		</div>
	);
}
