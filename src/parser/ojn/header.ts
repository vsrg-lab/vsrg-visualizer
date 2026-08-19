import type { ParseError, Warning } from "../../model/types";

/** The decoded 300-byte OJN header. Strings are NUL-trimmed and charset-decoded. */
export type OjnHeader = {
	encodeVersion: number;
	bpm: number;
	level: [number, number, number];
	eventCount: [number, number, number];
	noteCount: [number, number, number];
	measureCount: [number, number, number];
	packageCount: [number, number, number];
	title: string;
	artist: string;
	noter: string;
	duration: [number, number, number];
	noteOffset: [number, number, number];
	coverOffset: number;
};

/** Outcome of reading the header: the decoded fields, or why it failed. */
export type HeaderRead =
	| { ok: true; header: OjnHeader; warnings: Warning[] }
	| { ok: false; error: ParseError };

const HEADER_SIZE = 300;
const SIGNATURE = 0x006e6a6f;

/** Reads one of the per-difficulty int32 triplets. */
function readTriple(view: DataView, offset: number): [number, number, number] {
	return [view.getInt32(offset, true), view.getInt32(offset + 4, true), view.getInt32(offset + 8, true)];
}

/** Reads a NUL-terminated fixed-width field, trying UTF-8 first and falling back to EUC-KR. */
function readString(view: DataView, offset: number, width: number, field: string, warnings: Warning[]): string {
	const bytes = new Uint8Array(view.buffer, offset, width);
	const end = bytes.indexOf(0);
	const body = end < 0 ? bytes : bytes.subarray(0, end);

	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(body).trim();
	} catch {
		warnings.push({
			code: "encoding-detected",
			message: `${field} is not valid UTF-8; decoded as EUC-KR`
		});

		return new TextDecoder("euc-kr").decode(body).trim();
	}
}

/**
 * Reads the fixed 300-byte little-endian header. Fails only when the file is too short
 * or the "ojn\0" signature is missing - everything else is a warning.
 */
export function readHeader(bytes: ArrayBuffer): HeaderRead {
	if (bytes.byteLength < HEADER_SIZE)
		return {
			ok: false,
			error: {
				line: 1,
				message: "file is shorter than the 300-byte OJN header"
			}
		};

	const view = new DataView(bytes);
	if (view.getInt32(4, true) !== SIGNATURE)
		return {
			ok: false,
			error: {
				line: 1,
				message: "missing \"ojn\\0\" signature; not an O2Jam chart"
			}
		};

	const warnings: Warning[] = [];
	const encodeVersion = view.getFloat32(8, true);
	if (!(encodeVersion > 0 && encodeVersion < 100))
		warnings.push({
			code: "encode-version-unusual",
			message: `unusual encode version ${encodeVersion}`
		});

	return {
		ok: true,
		warnings,
		header: {
			encodeVersion,
			bpm: view.getFloat32(0x10, true),
			level: [view.getInt16(0x14, true), view.getInt16(0x16, true), view.getInt16(0x18, true)],
			eventCount: readTriple(view, 0x1C),
			noteCount: readTriple(view, 0x28),
			measureCount: readTriple(view, 0x34),
			packageCount: readTriple(view, 0x40),
			title: readString(view, 0x6C, 64, "title", warnings),
			artist: readString(view, 0xAC, 32, "artist", warnings),
			noter: readString(view, 0xCC, 32, "noter", warnings),
			duration: readTriple(view, 0x110),
			noteOffset: readTriple(view, 0x11C),
			coverOffset: view.getInt32(0x128, true)
		}
	};
}
