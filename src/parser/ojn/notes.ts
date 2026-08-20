import type { TimingEvent, SourceNote } from "../../model/source";
import type { Warning } from "../../model/types";

/** What one difficulty's note section produced, with tallies for the header cross-check. */
export type NoteSection = {
	events: TimingEvent[];
	notes: SourceNote[];
	counts: {
		packages: number;
		events: number;
		notes: number;
		measures: number;
	};
};

/** A package with its events already read; the payload is interpreted by channel later. */
type RawPackage = {
	measure: number;
	channel: number;
	events: {
		position: number;
		float: number;
		value: number;
		type: number
	}[];
};

/** Builds a measure-to-fraction lookup (1.0 = 4/4); zero or invalid fractions are skipped with warnings. */
function measureFractions(packages: RawPackage[], warnings: Warning[]): (measure: number) => number {
	const fractions = new Map<number, number>();

	for (const pkg of packages)
		if (pkg.channel === 0)
			for (const event of pkg.events) {
				if (event.float === 0)
					continue;
				if (!(event.float > 0)) {
					warnings.push({
						code: "invalid-measure-ratio",
						message: `measure ${pkg.measure} fraction ${event.float} is not positive; using 1.0`
					});
					continue;
				}

				fractions.set(pkg.measure, event.float);
			}

	return measure => fractions.get(measure) ?? 1;
}

/**
 * Walks one difficulty's packages between start and end. Channel 0 sets the measure fraction,
 * channel 1 changes the bpm, channels 2-8 place notes; every other channel is read but ignored.
 * A section that runs out of bytes stops early with a warning.
 */
export function readNoteSection(
	view: DataView,
	start: number,
	end: number,
	warnings: Warning[]
): NoteSection {
	const packages: RawPackage[] = [];
	let eventTally = 0;
	let offset = start;
	let truncated = false;

	while (offset + 8 <= end) {
		const measure = view.getInt32(offset, true);
		const channel = view.getInt16(offset + 4, true);
		const count = view.getInt16(offset + 6, true);
		offset += 8;

		if (measure < 0) {
			warnings.push({
				code: "invalid-measure",
				message: `package with negative measure ${measure} skipped`
			});

			offset += count * 4;
			continue;
		}

		const pkg: RawPackage = { measure, channel, events: [] };
		for (let i = 0; i < count && offset + 4 <= end; i++) {
			pkg.events.push({
				position: i / count,
				float: view.getFloat32(offset, true),
				value: view.getInt16(offset, true),
				type: view.getUint8(offset + 3)
			});
			offset += 4;
			eventTally++;
		}

		packages.push(pkg);
		if (pkg.events.length < count) {
			truncated = true;
			break;
		}
	}

	if (truncated || offset < end)
		warnings.push({
			code: "truncated-section",
			message: `note section ended early at byte ${offset} (section ends at ${end})`
		});

	const fractionOf = measureFractions(packages, warnings);
	const measureStarts: number[] = [];

	let maxMeasure = -1;
	for (const pkg of packages)
		maxMeasure = Math.max(maxMeasure, pkg.measure);
	for (let m = 0; m <= maxMeasure; m++)
		measureStarts[m] = m === 0 ? 0 : measureStarts[m - 1]! + 4 * fractionOf(m - 1);

	const events: TimingEvent[] = [];
	for (let m = 0; m <= maxMeasure; m++)
		events.push({ kind: "meter", at: measureStarts[m]!, beats: 4 * fractionOf(m), noteValue: 4 });

	const beatOf = (pkg: RawPackage, position: number): number =>
		measureStarts[pkg.measure]! + position * 4 * fractionOf(pkg.measure);

	const open = new Map<number, number>();
	const notes: SourceNote[] = [];
	let noteTally = 0;

	for (const pkg of packages) {
		if (pkg.channel === 1) {
			for (const event of pkg.events)
				if (event.float !== 0)
					events.push({ kind: "bpm", at: beatOf(pkg, event.position), bpm: event.float });
			continue;
		}

		if (pkg.channel < 2 || pkg.channel > 8)
			continue;

		const lane = pkg.channel - 2;
		for (const event of pkg.events) {
			if (event.value === 0)
				continue;

			const kind = event.type % 4;
			if (kind !== 3)
				noteTally++;

			const at = beatOf(pkg, event.position);
			if (kind === 2) {
				open.set(lane, at);
				continue;
			}

			if (kind === 3) {
				const startAt = open.get(lane);
				if (startAt === undefined) {
					warnings.push({
						code: "unpaired-ln-end",
						message: `long note end without a start on lane ${lane}; dropped`
					});
					continue;
				}

				open.delete(lane);
				if (at <= startAt) {
					warnings.push({
						code: "zero-length-hold",
						message: `zero-length hold on lane ${lane}; treated as a tap`
					});
					notes.push({ kind: "tap", at: startAt, lane });
				} else
					notes.push({ kind: "hold", lane, at: startAt, end: at });

				continue;
			}

			notes.push({ kind: "tap", at, lane });
		}
	}

	for (const [lane, startAt] of open) {
		warnings.push({
			code: "unpaired-ln",
			message: `long note on lane ${lane} never ends; treated as a tap`
		});
		notes.push({ kind: "tap", at: startAt, lane });
	}

	return {
		events,
		notes,
		counts: {
			packages: packages.length,
			events: eventTally,
			notes: noteTally,
			measures: maxMeasure + 1
		}
	};
}
