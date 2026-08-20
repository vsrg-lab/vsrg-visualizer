import type { Layout } from "../../model/types";

/** One `#xxxCC:data` line split into its parts, with the 1-based source line. */
export type ChannelLine = { measure: number; channel: string; data: string; line: number };

/** Semantic role of a channel, deciding how its objects are converted. */
export type ChannelKind =
	| "bgm"
	| "meter"
	| "bpm"
	| "stop"
	| "bga"
	| "note"
	| "invisible"
	| "ln"
	| "mine"
	| "scroll"
	| "speed"
	| "unknown";

const CHANNEL_LINE = /^#(\d{1,3})([0-9A-Za-z]{2}):(.*)$/;

/** Key-channel suffixes per player side: `1`-`5` for 5-key, plus `8`/`9` for 7-key. */
const KEYS_5 = ["1", "2", "3", "4", "5"];
const KEYS_7 = ["1", "2", "3", "4", "5", "8", "9"];

/** Picks out channel-data lines from preprocessed lines; other lines are ignored here. */
export function readChannelLines(lines: string[]): ChannelLine[] {
	const result: ChannelLine[] = [];
	for (let index = 0; index < lines.length; index++) {
		const match = CHANNEL_LINE.exec(lines[index]!);
		if (match)
			result.push({
				measure: Number(match[1]),
				channel: match[2]!.toUpperCase(),
				data: match[3]!,
				line: index + 1
			});
	}

	return result;
}

/** Classifies a channel id (case-insensitive) into its semantic role. */
export function classifyChannel(channel: string): ChannelKind {
	const id = channel.toUpperCase();
	if (id === "01")
		return "bgm";
	if (id === "02")
		return "meter";
	if (id === "03" || id === "08")
		return "bpm";
	if (id === "09")
		return "stop";
	if (id === "04" || id === "06" || id === "07")
		return "bga";
	if (id === "SC")
		return "scroll";
	if (id === "SP")
		return "speed";
	if (/^[12][1-689]$/.test(id))
		return "note";
	if (/^[56][1-689]$/.test(id))
		return "ln";
	if (/^[DE][1-9]$/.test(id))
		return "mine";
	if (/^[34][1-9]$/.test(id))
		return "invisible";

	return "unknown";
}

/** base36 value of a two-character object id; null when either character is invalid. */
export function parseBase36Pair(pair: string): number | null {
	if (pair.length !== 2)
		return null;

	let value = 0;
	for (const character of pair) {
		const digit = Number.parseInt(character, 36);
		if (Number.isNaN(digit))
			return null;

		value = value * 36 + digit;
	}

	return value;
}

/** Decides the layout from the channels that actually hold objects. isPms comes from the file extension. */
export function detectLayout(usedChannels: Set<string>, isPms: boolean): Layout {
	const used = new Set([...usedChannels].map(channel => channel.toUpperCase()));
	// 2P promotion triggers: visible 21-29, invisible 41-49, LN 61-69, mines E1-E9 (beatoraja behavior).
	const has2p = [...used].some(channel => /^(2[1-9]|4[1-9]|6[1-9]|E[1-9])$/.test(channel));
	const hasKeys78 = used.has("18") || used.has("19");

	if (isPms)
		return { totalKeys: 9, normalKeys: 9, specialLanes: [], stages: 1 };
	if (has2p) {
		const scratch1p = used.has("16");
		const scratch2p = used.has("26");
		const totalKeys = (hasKeys78 ? 14 : 10) + (scratch1p ? 1 : 0) + (scratch2p ? 1 : 0);
		const specialLanes = [...(scratch1p ? [0] : []), ...(scratch2p ? [totalKeys - 1] : [])];

		return {
			totalKeys,
			normalKeys: totalKeys - specialLanes.length,
			specialLanes,
			stages: hasKeys78 ? 2 : 1
		};
	}

	if (hasKeys78) {
		const scratch = used.has("16");
		return {
			totalKeys: scratch ? 8 : 7,
			normalKeys: 7,
			specialLanes: scratch ? [0] : [],
			stages: 1
		};
	}

	return {
		totalKeys: 5,
		normalKeys: 5,
		specialLanes: [],
		stages: 1
	};
}

type Mode = "5k" | "7k" | "9k" | "10k" | "14k";

function modeOf(layout: Layout): Mode {
	if (layout.stages === 2)
		return "14k";

	switch (layout.normalKeys) {
		case 9:
			return "9k";
		case 10:
			return "10k";
		case 7:
			return "7k";
		default:
			return "5k";
	}
}

/** Channel-to-lane table for the decided layout, built once per file and then queried per object. */
export function buildLaneMap(layout: Layout): Map<string, number> {
	const mode = modeOf(layout);
	const lanes = new Map<string, number>();
	const scratch1p = layout.specialLanes.includes(0);
	const scratch2p = layout.specialLanes.includes(layout.totalKeys - 1);

	if (mode === "9k") {
		KEYS_5.forEach((key, index) => lanes.set("1" + key, index));
		["2", "3", "4", "5"].forEach((key, index) => lanes.set("2" + key, KEYS_5.length + index));
	} else {
		const keys1p = mode === "7k" || mode === "14k" ? KEYS_7 : KEYS_5;
		const offset1 = scratch1p ? 1 : 0;

		if (scratch1p)
			lanes.set("16", 0);

		keys1p.forEach((key, index) => lanes.set("1" + key, offset1 + index));

		if (mode === "10k" || mode === "14k") {
			const keys2p = mode === "14k" ? KEYS_7 : KEYS_5;
			const offset2 = offset1 + keys1p.length;

			keys2p.forEach((key, index) => lanes.set("2" + key, offset2 + index));
			if (scratch2p)
				lanes.set("26", layout.totalKeys - 1);
		}
	}

	// LN and mine channels share lanes with their visible counterparts.
	for (const [note, lane] of [...lanes]) {
		const side = note.charAt(0);
		const key = note.charAt(1);

		if (side === "1") {
			lanes.set("5" + key, lane);
			lanes.set("D" + key, lane);
		} else if (side === "2") {
			lanes.set("6" + key, lane);
			lanes.set("E" + key, lane);
		}
	}

	return lanes;
}
