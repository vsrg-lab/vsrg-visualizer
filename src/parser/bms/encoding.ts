import type { Warning } from "../../model/types";

/** Decoded BMS text plus any warnings the detection itself produced. */
type Decoded = { text: string; warnings: Warning[] };

/**
 * Decodes BMS bytes. BMS files are overwhelmingly Shift-JIS but newer ones may be UTF-8,
 * so a BOM or a strict UTF-8 pass wins and only a hard failure falls back to Shift-JIS.
 */
export function decodeBms(bytes: ArrayBuffer): Decoded {
	const buffer = new Uint8Array(bytes);
	const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
	const body = hasBom ? buffer.slice(3) : buffer;

	if (hasBom)
		return { text: new TextDecoder("utf-8").decode(body), warnings: [] };

	try {
		return { text: new TextDecoder("utf-8", { fatal: true }).decode(body), warnings: [] };
	} catch {
		return {
			text: new TextDecoder("shift_jis").decode(body),
			warnings: [{
				code: "encoding-detected",
				message: "file is not valid UTF-8; decoded as Shift-JIS"
			}]
		};
	}
}
