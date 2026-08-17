import type { TimingEvent } from "../../model/source";
import type { Warning } from "../../model/types";

/** A beat span whose notes are unhittable. Applied to notes by the caller. */
export type FakeRegion = { start: number; end: number };

/** Everything the timing tags of one chart contribute. */
export type SmTiming = { events: TimingEvent[]; fakes: FakeRegion[] };

/** One `beat=a=b` entry from a timing tag. */
type Entry = { at: number; parts: number[] };

/** Samples per beat used to approximate an interpolated #SPEEDS ramp. */
const RAMP_SAMPLES_PER_BEAT = 8;
const MAX_RAMP_SAMPLES = 64;

function parseEntries(raw: string | undefined): Entry[] {
	if (raw === undefined)
		return [];

	const entries: Entry[] = [];
	for (const chunk of raw.split(",")) {
		if (chunk.trim() === "")
			continue;

		const numbers = chunk.split("=").map(part => Number(part.trim()));
		if (numbers.length < 2 || numbers.some(value => !Number.isFinite(value)))
			continue;

		entries.push({ at: numbers[0], parts: numbers.slice(1) });
	}

	entries.sort((a, b) => a.at - b.at);

	return entries;
}

/** Value of a step function at a beat; entries must be sorted. */
function valueAt(entries: Entry[], at: number, fallback: number): number {
	let value = fallback;
	for (const entry of entries) {
		if (entry.at > at)
			break;

		value = entry.parts[0];
	}

	return value;
}

/** Negative bpm spans and negative stops are how older StepMania files spell a warp. */
function buildBpmEvents(bpms: Entry[], warnings: Warning[]): { events: TimingEvent[]; warps: TimingEvent[] } {
	const events: TimingEvent[] = [];
	const warps: TimingEvent[] = [];

	for (let i = 0; i < bpms.length; i++) {
		const bpm = bpms[i].parts[0];
		if (bpm > 0) {
			events.push({ kind: "bpm", at: bpms[i].at, bpm });
			continue;
		}

		const next = bpms[i + 1];
		if (!next) {
			warnings.push({
				code: "trailing-negative-bpm",
				message: `negative bpm at beat ${bpms[i].at} has no following bpm; ignored`
			});
			continue;
		}

		warps.push({ kind: "warp", at: bpms[i].at, lengthBeats: next.at - bpms[i].at });
	}

	return { events, warps };
}

function buildStopEvents(
	stops: Entry[],
	positiveBpmAt: (beat: number) => number,
	warnings: Warning[]
): { events: TimingEvent[]; warps: TimingEvent[] }{
	const events: TimingEvent[] = [];
	const warps: TimingEvent[] = [];

	for (const stop of stops) {
		const seconds = stop.parts[0];
		if (seconds >= 0) {
			events.push({
				kind: "stop",
				at: stop.at,
				duration: {
					unit: "ms",
					value: seconds * 1000
				}
			});
			continue;
		}

		const beats = -seconds * positiveBpmAt(stop.at) / 60;
		warnings.push({
			code: "negative-stop-as-warp",
			message: `negative stop at beat ${stop.at} read as a ${beats.toFixed(3)}-beat warp`
		});
		warps.push({ kind: "warp", at: stop.at, lengthBeats: beats });
	}

	return { events, warps };
}

/**
 * #SCROLLS and #SPEEDS are separate multipliers that StepMania applies together, but the model
 * carries a single sv. Both are sampled at every breakpoint and multiplied into one timeline.
 * A #SPEEDS entry with a delay ramps toward its target, which is approximated with fixed steps.
 */
function buildSvEvents(
	scrolls: Entry[],
	speeds: Entry[],
	positiveBpmAt: (beat: number) => number
): TimingEvent[] {
	const samples: Entry[] = [];
	let previous = 1;

	for (const speed of speeds) {
		const target = speed.parts[0];
		const delay = speed.parts.length > 1 ? speed.parts[1] : 0;
		const unit = speed.parts.length > 2 ? speed.parts[2] : 0;
		const lengthBeats = unit === 1 ? delay * positiveBpmAt(speed.at) / 60 : delay;

		if (!(lengthBeats > 0)) {
			samples.push({ at: speed.at, parts: [target] });
			previous = target;
			continue;
		}

		const steps = Math.min(Math.max(Math.ceil(lengthBeats * RAMP_SAMPLES_PER_BEAT), 1), MAX_RAMP_SAMPLES);
		for (let step = 1; step <= steps; step++)
			samples.push({
				at: speed.at + lengthBeats * step / steps,
				parts: [previous + (target - previous) * step / steps]
			});

		previous = target;
	}

	samples.sort((a, b) => a.at - b.at);

	const breakpoints = [...new Set([...scrolls, ...samples].map(entry => entry.at))].sort((a, b) => a - b);
	const events: TimingEvent[] = [];
	for (const at of breakpoints)
		events.push({ kind: "sv", at, multiplier: valueAt(scrolls, at, 1) * valueAt(samples, at, 1) });

	return events;
}

/** Converts the resolved timing tags of one chart into source events. */
export function parseSmTiming(tags: Map<string, string>, warnings: Warning[]): SmTiming {
	const bpms = parseEntries(tags.get("BPMS"));
	const positibeBpms = bpms.filter(entry => entry.parts[0] > 0);
	const positiveBpmAt = (beat: number): number => valueAt(positibeBpms, beat, 120);

	const bpm = buildBpmEvents(bpms, warnings);
	const stops = buildStopEvents(parseEntries(tags.get("STOPS")), positiveBpmAt, warnings);
	const delays = buildStopEvents(parseEntries(tags.get("DELAYS")), positiveBpmAt, warnings);

	const warps = parseEntries(tags.get("WARPS"))
		.map((entry): TimingEvent => ({ kind: "warp", at: entry.at, lengthBeats: entry.parts[0] }));

	const meters = parseEntries(tags.get("TIMESIGNATURES"))
		.map((entry): TimingEvent => ({
			kind: "meter",
			at: entry.at,
			beats: entry.parts[0] > 0 ? entry.parts[0] : 4,
			noteValue: entry.parts.length > 1 && entry.parts[1] > 0 ? entry.parts[1] : 4
		}));

	const sv = buildSvEvents(parseEntries(tags.get("SCROLLS")), parseEntries(tags.get("SPEEDS")), positiveBpmAt);

	const fakes = parseEntries(tags.get("FAKES"))
		.map(entry => ({ start: entry.at, end: entry.at + entry.parts[0] }))
		.filter(region => region.end > region.start);

	const events: TimingEvent[] = [
		// beat 0 anchors the measure grid; #TIMESIGNATURES entries move it afterwards
		{ kind: "meter", at: 0, beats: 4, noteValue: 4 },
		...bpm.events,
		...bpm.warps,
		...stops.events,
		...stops.warps,
		...delays.events,
		...delays.warps,
		...warps,
		...meters,
		...sv
	];

	return { events, fakes };
}
