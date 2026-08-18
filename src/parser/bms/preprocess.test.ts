import { describe, expect, it } from "vitest";

import { resolveBranches } from "./preprocess";

/** Fixed-value rng: always returns the given value regardless of max. */
function rngOf(value: number) {
	return () => value;
}

/** Sequential rng factory: each fresh instance replays the same value list. */
function sequenceRng(...values: number[]) {
	let index = 0;
	return () => values[index++] ?? 1;
}

describe("resolveBranches", () => {
	it("keeps lines untouched when no control statements are present", () => {
		const text = ["#TITLE Test", "", "#00011:0100", "garbage line"].join("\n");
		const result = resolveBranches(text, rngOf(1));
		expect(result.lines).toEqual(["#TITLE Test", "", "#00011:0100", "garbage line"]);
		expect(result.usedRandom).toBe(false);
	});

	it("keeps only the matching #IF block for the rolled #RANDOM value", () => {
		const text = [
			"#RANDOM 2",
			"#IF 1",
			"#00111:0100",
			"#ENDIF",
			"#IF 2",
			"#00112:0100",
			"#ENDIF",
			"#ENDRANDOM"
		].join("\n");
		const result = resolveBranches(text, rngOf(2));
		expect(result.lines).toEqual(["#00112:0100"]);
		expect(result.usedRandom).toBe(true);
	});

	it("resolves nested #RANDOM blocks", () => {
		const text = [
			"#RANDOM 2",
			"#IF 2",
			"#RANDOM 3",
			"#IF 1",
			"#00111:0100",
			"#ENDIF",
			"#IF 3",
			"#00112:0100",
			"#ENDIF",
			"#ENDRANDOM",
			"#ENDIF",
			"#ENDRANDOM"
		].join("\n");
		const result = resolveBranches(text, sequenceRng(2, 3));
		expect(result.lines).toEqual(["#00112:0100"]);
	});

	it("fixes the value with #SETRANDOM without consuming rng", () => {
		const rngCalls: number[] = [];
		const rng = (max: number) => {
			rngCalls.push(max);
			return 1;
		};
		const text = [
			"#SETRANDOM 3",
			"#IF 3",
			"#00111:0100",
			"#ENDIF",
			"#ENDRANDOM"
		].join("\n");
		const result = resolveBranches(text, rng);
		expect(result.lines).toEqual(["#00111:0100"]);
		expect(result.usedRandom).toBe(true);
		expect(rngCalls).toEqual([]);
	});

	it("keeps only the matching #CASE block in a #SWITCH", () => {
		const text = [
			"#SWITCH 3",
			"#CASE 1",
			"#00111:0100",
			"#SKIP",
			"#CASE 2",
			"#00112:0100",
			"#ENDSW"
		].join("\n");
		const result = resolveBranches(text, rngOf(2));
		expect(result.lines).toEqual(["#00112:0100"]);
	});

	it("produces identical output for identical rng sequences", () => {
		const text = [
			"#RANDOM 2",
			"#IF 2",
			"#SWITCH 2",
			"#CASE 2",
			"#00111:0100",
			"#ENDSW",
			"#ENDIF",
			"#ENDRANDOM"
		].join("\n");
		const first = resolveBranches(text, sequenceRng(2, 2));
		const second = resolveBranches(text, sequenceRng(2, 2));
		expect(second.lines).toEqual(first.lines);
		expect(second.usedRandom).toBe(first.usedRandom);
	});

	it("drops data lines in skipped blocks while still applying control flow", () => {
		const rngCalls: number[] = [];
		const rng = (max: number) => {
			rngCalls.push(max);
			return 1;
		};
		const text = [
			"#RANDOM 2",
			"#IF 2",
			"#RANDOM 5",
			"#IF 1",
			"#00111:0100",
			"#ENDIF",
			"#ENDRANDOM",
			"#ENDIF",
			"#ENDRANDOM",
			"#00112:0100"
		].join("\n");
		const result = resolveBranches(text, rng);
		expect(result.lines).toEqual(["#00112:0100"]);
		expect(rngCalls).toEqual([2, 5]);
	});
});
