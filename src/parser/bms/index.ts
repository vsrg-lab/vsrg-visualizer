import { buildLaneMap, classifyChannel, detectLayout, parseBase36Pair, readChannelLines, type ChannelLine } from "./channels";
import { decodeBms } from "./encoding";
import { resolveBranches, type Rng } from "./preprocess";
import type { ParseResult, SourceChart, SourceNote, TimingEvent } from "../../model/source";
import type { Warning } from "../../model/types";

/** Difficulty labels for #DIFFICULTY 1-5. */
const DIFFICULTY_NAMES = ["BEGINNER", "NORMAL", "HYPER", "ANOTHER", "INSANE"];

const HEADER = /^#([A-Za-z0-9]+)\s+(.+)$/;

const RAMP_SAMPLES_PER_BEAT = 8;
const MAX_RAMP_SAMPLES = 64;

/** A placed object before lanes are known: channel, beat, id, and source position. */
type RawObject = { channel: string; at: number; id: number; line: number; sequence: number };

/** A scroll/speed keyframe after its #SCROLLxx/#SPEEDxx definition was resolved. */
type SvEntry = { at: number; multiplier: number };

function warnOnce(warned: Set<string>, warnings: Warning[], key: string, message: string): void {
	if (warned.has(key))
		return;

	warned.add(key);
	warnings.push({
		code: "unknown-channel",
		message
	});
}

function readHeaders(lines: string[]): Map<string, string> {
	const headers = new Map<string, string>();

	for (const line of lines) {
		const match = HEADER.exec(line);
		if (match && !headers.has(match[1]!.toUpperCase()))
			headers.set(match[1]!.toUpperCase(), match[2]!.trim());
	}

	return headers;
}

function readMeasureRates(channelLines: ChannelLine[], warnings: Warning[]): Map<number, number> {
	const rates = new Map<number, number>();
	for (const line of channelLines) {
		if (line.channel !== "02")
			continue;

		const ratio = Number(line.data.trim());
		if (!Number.isFinite(ratio) || ratio <= 0) {
			warnings.push({
				line: line.line,
				code: "invalid-measure-ratio",
				message: `ignoring invalid measure ratio "${line.data}"`
			});
			continue;
		}

		if (!rates.has(line.measure))
			rates.set(line.measure, ratio);
	}

	return rates;
}

/** Two-character uppercase base36 form of an object id, for #BPMxx-style table lookups. */
function toBase36Id(id: number): string {
	return id.toString(36).toUpperCase().padStart(2, "0");
}

/** Samples the piecewise-linear speed ramp between consecutive keyframes. */
function speedSamples(speeds: SvEntry[]): SvEntry[] {
	const samples: SvEntry[] = [];

	for (let i = 0; i + 1 < speeds.length; i++) {
		const from = speeds[i]!;
		const to = speeds[i + 1]!;
		const length = to.at - from.at;

		if (length <= 0)
			continue;

		const steps = Math.min(Math.max(Math.ceil(length * RAMP_SAMPLES_PER_BEAT), 1), MAX_RAMP_SAMPLES);
		for (let step = 1; step < steps; step++)
			samples.push({
				at: from.at + (length * step) / steps,
				multiplier: from.multiplier + ((to.multiplier - from.multiplier) * step) / steps
			});
	}

	return samples;
}

/** Multiplies SC (step) and SP (linearly sampled) into one SV timeline at shared breakpoints. */
function buildSvEvents(scrolls: SvEntry[], speeds: SvEntry[]): TimingEvent[] {
	if (scrolls.length === 0 && speeds.length === 0)
		return [];

	// Keyframes and their samples interleave, so the concatenation has to be re-sorted before a step lookup means anything.
	const sampled = [...speeds, ...speedSamples(speeds)].sort((a, b) => a.at - b.at);
	const breakpoints = [...new Set([...scrolls, ...sampled].map(entry => entry.at))].sort((a, b) => a - b);
	const events: TimingEvent[] = [];

	let scrollIndex = -1;
	let sampleIndex = -1;
	let previous = 1;

	for (const at of breakpoints) {
		while (scrollIndex + 1 < scrolls.length && scrolls[scrollIndex + 1]!.at <= at)
			scrollIndex++;
		while (sampleIndex + 1 < sampled.length && sampled[sampleIndex + 1]!.at <= at)
			sampleIndex++;

		const multiplier = (scrollIndex < 0 ? 1 : scrolls[scrollIndex]!.multiplier) * (sampleIndex < 0 ? 1 : sampled[sampleIndex]!.multiplier);
		if (multiplier !== previous) {
			events.push({ kind: "sv", at, multiplier });
			previous = multiplier;
		}
	}

	return events;
}

/** Parses a .bms/.bme/.bml/.pms document (raw bytes - BMS owns its own decoding). */
export function parseBms(bytes: ArrayBuffer, rng: Rng, isPms: boolean): ParseResult {
	const warnings: Warning[] = [];
	const decoded = decodeBms(bytes);
	warnings.push(...decoded.warnings);

	const resolved = resolveBranches(decoded.text, rng);
	if (resolved.usedRandom)
		warnings.push({
			code: "random-branch",
			message: "random branch rolled; use Reroll to see another variant"
		});

	const channelLines = readChannelLines(resolved.lines);
	if (channelLines.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "no channel data found; not a BMS file"
			}]
		};

	const headers = readHeaders(resolved.lines);
	const initialBpm = Number(headers.get("BPM"));
	if (!headers.has("BPM") || !Number.isFinite(initialBpm))
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "missing or invalid initial #BPM"
			}]
		};

	const maxMeasure = Math.max(...channelLines.map(line => line.measure));
	const rates = readMeasureRates(channelLines, warnings);
	const events: TimingEvent[] = [{ kind: "bpm", at: 0, bpm: initialBpm }];
	const measureStarts: number[] = [];

	let start = 0;
	for (let measure = 0; measure <= maxMeasure; measure++) {
		const beats = 4 * (rates.get(measure) ?? 1);
		measureStarts[measure] = start;
		events.push({ kind: "meter", at: start, beats, noteValue: 4 });
		start += beats;
	}

	const objects: RawObject[] = [];
	const usedChannels = new Set<string>();

	let sequence = 0;
	for (const line of channelLines) {
		if (classifyChannel(line.channel) === "meter")
			continue;

		let data = line.data;
		if (data.length % 2 === 1) {
			warnings.push({
				line: line.line,
				code: "odd-channel-data",
				message: `dropped trailing character of odd-length data on channel ${line.channel}`
			});
			data = data.slice(0, -1);
		}

		const pairs = data.length / 2;
		if (pairs === 0)
			continue;

		const measureStart = measureStarts[line.measure] ?? 0;
		const lengthBeats = 4 * (rates.get(line.measure) ?? 1);

		for (let pair = 0; pair < pairs; pair++) {
			const id = parseBase36Pair(data.slice(pair * 2, pair * 2 + 2));
			if (id === null) {
				warnings.push({
					line: line.line,
					code: "invalid-object-id",
					message: `invalid base36 object id on channel ${line.channel}`
				});
				continue;
			}

			if (id === 0)
				continue;

			usedChannels.add(line.channel);
			objects.push({
				channel: line.channel,
				at: measureStart + (lengthBeats * pair) / pairs,
				id,
				line: line.line,
				sequence: sequence++
			});
		}
	}

	const layout = detectLayout(usedChannels, isPms);
	const laneMap = buildLaneMap(layout);
	const laneOf = (channel: string): number | null => laneMap.get(channel.toUpperCase()) ?? null;
	objects.sort((a, b) => a.at - b.at || a.sequence - b.sequence);

	const notes: SourceNote[] = [];
	const lastTap = new Map<number, number>();
	const lnQueues = new Map<number, RawObject[]>();
	const lnobjId = parseBase36Pair(headers.get("LNOBJ")?.trim() ?? "");
	const lntype = Number(headers.get("LNTYPE"));
	const lnActive = !headers.has("LNTYPE") || lntype === 1 || (lntype !== 0 && lntype !== 2);
	let lnDemoted = false;

	const warnedChannels = new Set<string>();
	const scrolls: SvEntry[] = [];
	const speeds: SvEntry[] = [];

	for (const object of objects)
		switch (classifyChannel(object.channel)) {
			case "note": {
				const lane = laneOf(object.channel);
				if (lane === null) {
					warnOnce(warnedChannels, warnings, object.channel, `channel ${object.channel} has no lane in the decided layout; object dropped`);
					break;
				}
				if (lnobjId !== null && object.id === lnobjId) {
					const tapIndex = lastTap.get(lane);
					const tap = tapIndex === undefined ? undefined : notes[tapIndex];
					if (tapIndex !== undefined && tap?.kind === "tap") {
						notes[tapIndex] = { kind: "hold", lane, at: tap.at, end: object.at };
						lastTap.delete(lane);
						break;
					}
				}
				notes.push({ kind: "tap", at: object.at, lane });
				lastTap.set(lane, notes.length - 1);
				break;
			}
			case "mine": {
				const lane = laneOf(object.channel);
				if (lane !== null)
					notes.push({ kind: "mine", at: object.at, lane });
				break;
			}
			case "ln": {
				const lane = laneOf(object.channel);
				if (lane === null)
					break;
				if (!lnActive) {
					notes.push({ kind: "tap", at: object.at, lane });
					lnDemoted = true;
					break;
				}
				const queue = lnQueues.get(lane) ?? [];
				queue.push(object);
				lnQueues.set(lane, queue);
				break;
			}
			case "bpm": {
				if (object.channel === "03") {
					events.push({ kind: "bpm", at: object.at, bpm: Math.floor(object.id / 36) * 16 + (object.id % 36) });
					break;
				}
				const definition = Number(headers.get("BPM" + toBase36Id(object.id)));
				if (Number.isFinite(definition))
					events.push({ kind: "bpm", at: object.at, bpm: definition });
				else
					warnings.push({ line: object.line, code: "undefined-bpm-ref", message: `channel 08 object references undefined #BPM${toBase36Id(object.id)}` });
				break;
			}
			case "stop": {
				const definition = Number(headers.get("STOP" + toBase36Id(object.id)));
				if (Number.isFinite(definition))
					events.push({ kind: "stop", at: object.at, duration: { unit: "beats", value: definition / 48 } });
				else
					warnings.push({ line: object.line, code: "undefined-stop-ref", message: `channel 09 object references undefined #STOP${toBase36Id(object.id)}` });
				break;
			}
			case "scroll": {
				const definition = Number(headers.get("SCROLL" + toBase36Id(object.id)));
				if (Number.isFinite(definition))
					scrolls.push({ at: object.at, multiplier: definition });
				else
					warnings.push({ line: object.line, code: "undefined-scroll-ref", message: `channel SC object references undefined #SCROLL${toBase36Id(object.id)}` });
				break;
			}
			case "speed": {
				const definition = Number(headers.get("SPEED" + toBase36Id(object.id)));
				if (Number.isFinite(definition))
					speeds.push({ at: object.at, multiplier: definition });
				else
					warnings.push({ line: object.line, code: "undefined-speed-ref", message: `channel SP object references undefined #SPEED${toBase36Id(object.id)}` });
				break;
			}
			default:
				// bgm, bga, invisible: read but not drawn; unknown was already warned about below.
				break;
		}

	for (const object of objects)
		if (classifyChannel(object.channel) === "unknown")
			warnOnce(warnedChannels, warnings, object.channel, `unknown channel ${object.channel}; objects ignored`);

	for (const [lane, queue] of lnQueues) {
		for (let i = 0; i + 1 < queue.length; i += 2)
			notes.push({ kind: "hold", lane, at: queue[i]!.at, end: queue[i + 1]!.at });
		if (queue.length % 2 === 1) {
			const orphan = queue[queue.length - 1]!;
			notes.push({ kind: "tap", at: orphan.at, lane });
			warnings.push({ line: orphan.line, code: "unpaired-ln", message: `unpaired LN start on lane ${lane}; demoted to a tap` });
		}
	}
	if (lnDemoted)
		warnings.push({ code: "lntype-ignored", message: "#LNTYPE disables LN channels; long notes demoted to taps" });

	scrolls.sort((a, b) => a.at - b.at);
	speeds.sort((a, b) => a.at - b.at);
	events.push(...buildSvEvents(scrolls, speeds));

	if (notes.length === 0)
		return { ok: false, errors: [{ line: 1, message: "no notes found in this file" }] };

	const difficultyName = DIFFICULTY_NAMES[Number(headers.get("DIFFICULTY")) - 1] ?? "";
	const source: SourceChart = {
		metadata: {
			original: "BMS",
			title: headers.get("TITLE") ?? "",
			artist: headers.get("ARTIST") ?? "",
			creator: headers.get("SUBARTIST") ?? "",
			version: [difficultyName, headers.get("PLAYLEVEL") ?? ""].filter(part => part !== "").join(" ")
		},
		layout,
		timeAxis: "beat",
		bpmAffectsScroll: true,
		events,
		notes
	};
	return { ok: true, sources: [source], warnings };
}
