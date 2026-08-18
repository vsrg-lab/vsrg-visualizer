import { parseBms } from "./bms";
import type { Rng } from "./bms/preprocess";
import { parseOsu } from "./osu";
import { parseQua } from "./qua";
import { parseSm } from "./sm";
import { parseUrc } from "./urc";
import { compileChart } from "../engine/compile";
import type { ParseResult } from "../model/source";
import type { Chart, LoadResult, SourceFormat, Warning } from "../model/types";

/** Options for loadChart; rng seeds #RANDOM/#SWITCH brancehs in BMS. */
export type LoadOptions = { rng?: Rng };

const defaultRng: Rng = max => 1 + Math.floor(Math.random() * max);

/** Decodes as UTF-8 and drops a byte order mark if present. */
function decodeUtf8(bytes: ArrayBuffer): string {
	const text = new TextDecoder("utf-8").decode(bytes);
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function extensionOf(fileName: string): string {
	const dot = fileName.lastIndexOf(".");
	return dot < 0 ? "" : fileName.slice(dot + 1).toLowerCase();
}

/** Extension first, then content sniffing - files with missing or wrong extensions are common. */
function detectFormat(text: string, fileName: string): SourceFormat | null {
	const extension = extensionOf(fileName);
	if (extension === "urc" || extension === "osu" || extension === "qua")
		return extension;
	if (extension === "sm" || extension === "ssc")
		return "sm";
	if (extension === "bms" || extension === "bme" || extension === "bml" || extension === "pms")
		return "bms";

	const head = text.slice(0, 200);
	if (head.includes("@URC"))
		return "urc";
	if (head.includes("osu file format v"))
		return "osu";
	if (/^#(TITLE|VERSION|BPMS|NOTEDATA|OFFSET):/m.test(head))
		return "sm";
	// BMS channel lines and space-separated headers are ASCII, so sniffing survives
	// Shift-JIS decoding turning the rest of the text into garbage.
	if (/^#\d{3}[0-9A-Za-z]{2}:/m.test(head) || /^#[A-Z]+ \S/m.test(head))
		return "bms";
	if (/^(AudioFile|Mode|MapId|Title):/m.test(head))
		return "qua";

	return null;
}

function toLoadResult(sourceFormat: SourceFormat, parsed: ParseResult): LoadResult {
	if (!parsed.ok)
		return { ok: false, errors: parsed.errors };

	const charts: Chart[] = [];
	const warnings: Warning[] = [...(parsed.warnings ?? [])];

	for (const source of parsed.sources) {
		const compiled = compileChart(source);
		charts.push(compiled.chart);
		warnings.push(...compiled.warnings);
	}

	return { ok: true, set: { sourceFormat, charts, warnings } };
}

/** Loads one chart file: decode, detect format, parse, compile. */
export function loadChart(bytes: ArrayBuffer, fileName: string, options?: LoadOptions): LoadResult {
	const text = decodeUtf8(bytes);
	const format = detectFormat(text, fileName);

	if (format === null)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: `unrecognized chart format for "${fileName}"`
			}]
		};

	if (format === "urc")
		return toLoadResult("urc", parseUrc(text));
	if (format === "osu")
		return toLoadResult("osu", parseOsu(text));
	if (format === "sm")
		return toLoadResult("sm", parseSm(text));
	if (format === "bms")
		return toLoadResult("bms", parseBms(bytes, options?.rng ?? defaultRng, extensionOf(fileName) === "pms"));
	return toLoadResult("qua", parseQua(text));
}
