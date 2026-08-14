import { describe, expect, it } from "vitest";

import { splitSections } from "./sections";

const valid = [
	"@URC 1.1",
	"@Metadata",
	"Title: Song",
	"@Layout",
	"Type: 4",
	"@Timing",
	"0, 120.0, 4/4",
	"@Notes",
	"0, 0, N"
].join("\n");

describe("splitSections", () => {
	it("parses version and groups entries by section", () => {
		const r = splitSections(valid);
		expect(r.ok).toBe(true);

		if (!r.ok) 
			return;

		expect(r.version).toBe("1.1");
		expect(r.sections.get("Metadata")!.entries.map(e => e.text)).toEqual(["Title: Song"]);
		expect(r.sections.get("Notes")!.entries[0].lineNo).toBe(9);
	});

	it("ignores blank lines and # comments but keeps line numbers", () => {
		const text = "@URC 1.1\n\n# a comment\n@Metadata\nTitle: Song\n@Layout\nType: 4\n@Timing\n0, 120.0, 4/4\n@Notes\n0, 0, N";
		const r = splitSections(text);
		expect(r.ok).toBe(true);

		if (!r.ok) 
			return;

		expect(r.sections.get("Metadata")!.headerLine).toBe(4);
	});

	it("errors when first line is not @URC", () => {
		const r = splitSections("@Metadata\nTitle: x");
		expect(r.ok).toBe(false);

		if (r.ok) 
			return;

		expect(r.errors[0].message).toMatch(/@URC/);
	});

	it("errors when a required section is missing", () => {
		const r = splitSections("@URC 1.1\n@Metadata\nTitle: x\n@Layout\nType: 4\n@Timing\n0, 120.0, 4/4");
		expect(r.ok).toBe(false);

		if (r.ok) 
			return;

		expect(r.errors.some(e => /@Notes/.test(e.message))).toBe(true);
	});

	it("errors when sections are out of order", () => {
		const r = splitSections("@URC 1.1\n@Layout\nType: 4\n@Metadata\nTitle: x\n@Timing\n0, 120.0, 4/4\n@Notes\n0, 0, N");
		expect(r.ok).toBe(false);

		if (r.ok) 
			return;

		expect(r.errors.some(e => /order/i.test(e.message))).toBe(true);
	});
});
