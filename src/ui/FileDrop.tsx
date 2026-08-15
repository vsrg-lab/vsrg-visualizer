import { useRef, useState, type DragEvent } from "react";

import type { Chart } from "../model/types";
import { parseUrc } from "../parser/urc";

/** file picker + drag-drop zone that parses a .urc file and reports the result. */
export function FileDrop({ onChart }: { onChart: (chart: Chart) => void }) {
	const [errors, setErrors] = useState<string[]>([]);
	const inputRef = useRef<HTMLInputElement>(null);

	async function handleFile(file: File): Promise<void> {
		const text = await file.text();
		const result = parseUrc(text);

		if (result.ok) {
			setErrors([]);
			onChart(result.chart);
		} else
			setErrors(result.errors.map(e => `line ${e.line}: ${e.message}`));
	}

	function onDrop(e: DragEvent<HTMLDivElement>): void {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file)
			void handleFile(file);
	}

	return (
		<div>
			<div
				onDragOver={e => e.preventDefault()}
				onDrop={onDrop}
				onClick={() => inputRef.current?.click()}
				style={{ border: "2px dashed #556", padding: "16px", cursor: "pointer", textAlign: "center" }}
			>
				Drop a .urc file here, or click to choose
			</div>
			<input
				ref={inputRef}
				type="file"
				accept=".urc"
				style={{ display: "none" }}
				onChange={e => {
					const file = e.target.files?.[0];
					if (file)
						void handleFile(file);
				}}
			/>
			{errors.length > 0 && (
				<ul style={{ color: "#ff8888" }}>
					{errors.map((m, i) => <li key={i}>{m}</li>)}
				</ul>
			)}
		</div>
	);
}
