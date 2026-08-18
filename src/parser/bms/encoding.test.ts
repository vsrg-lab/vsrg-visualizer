import { describe, expect, it } from "vitest";

import { decodeBms } from "./encoding";

/** Encodes as UTF-8; the caller's fixtures are all valid UTF-8 or raw Shift-JIS bytes. */
function utf8(text: string): ArrayBuffer {
	return new TextEncoder().encode(text).buffer;
}

describe("decodeBms", () => {
	it("decodes plain ASCII without warnings", () => {
		const result = decodeBms(utf8("#TITLE Test\n"));
		expect(result.text).toBe("#TITLE Test\n");
		expect(result.warnings).toEqual([]);
	});

	it("drops a UTF-8 byte order mark", () => {
		const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("#TITLE Test")]);
		const result = decodeBms(bytes.buffer);
		expect(result.text).toBe("#TITLE Test");
		expect(result.warnings).toEqual([]);
	});

	it("decodes UTF-8 Japanese text without warnings", () => {
		const result = decodeBms(utf8("#TITLE 日本語タイトル"));
		expect(result.text).toBe("#TITLE 日本語タイトル");
		expect(result.warnings).toEqual([]);
	});

	it("falls back to Shift-JIS and warns when strict UTF-8 fails", () => {
		// "#TITLE " + "テスト" in Shift-JIS (0x83 0x65 0x83 0x58 0x83 0x67)
		const bytes = new Uint8Array([
			...new TextEncoder().encode("#TITLE "),
			0x83, 0x65, 0x83, 0x58, 0x83, 0x67
		]);
		const result = decodeBms(bytes.buffer);
		expect(result.text).toBe("#TITLE テスト");
		expect(result.warnings).toEqual([{
			code: "encoding-detected",
			message: "file is not valid UTF-8; decoded as Shift-JIS"
		}]);
	});
});
