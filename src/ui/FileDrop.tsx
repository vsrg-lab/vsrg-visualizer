import { useRef, type DragEvent } from "react";

type FileDropProps = {
	onFile: (file: File) => void;
};

/** File picker + drag-drop zone. Parsing lives in App so the raw bytes stay available for re-parsing. */
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
				className="border-2 border-dashed border-base-300 rounded-box p-4 text-center cursor-pointer text-base-content/70 hover:border-base-content/40"
			>
				Drop a chart file (.urc, .osu, .qua) here, or click to choose
			</div>
			<input
				ref={inputRef}
				type="file"
				accept=".urc,.osu,.qua"
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
