/** Assembles .ojn images for tests. Prodcution code never imports this module, so the bundler never sees it. */

/** Per-difficulty int32 triplet as the header stores it. */
type Triple = [number, number, number];

/** One package to assemble. Channels 0/1 carry float payloads; the rest carry note events. */
export type FixturePackage =
	| { measure: number; channel: 0 | 1; values: number[] }
	| { measure: number; channel: number; notes: [value: number, volumePan: number, type: number][] };

/** One difficulty slot; an empty package list yields a noteCount-0 difficulty. */
export type FixtureDifficulty = { packages: FixturePackage[] };

/** Knobs of buildOjn. Everything else gets a working default. */
export type FixtureOptions = {
	title?: string;
	titleBytes?: Uint8Array,
	artist?: string;
	noter?: string;
	bpm?: number;
	levels?: Triple;
	encodeVersion?: number;
	difficulties?: [FixtureDifficulty, FixtureDifficulty, FixtureDifficulty];
	/** Per-counter header overrides - a mismatch against the assembled bytes is what the cross-check tests need. */
	counts?: Partial<{ events: Triple; notes: Triple; measures: Triple; packages: Triple }>;
	durations?: Triple;
};

const HEADER_SIZE = 300;
const SIGNATURE = 0x006e6a6f;

/** Counts what the header count fields would report for these packages. */
function countSection(packages: FixturePackage[]): { events: number; notes: number; measures: number; packages: number } {
	let events = 0;
	let notes = 0;
	let maxMeasure = -1;

	for (const pkg of packages) {
		maxMeasure = Math.max(maxMeasure, pkg.measure);
		if ("values" in pkg) {
			events += pkg.values.length;
			continue;
		}

		events += pkg.notes.length;
		if (pkg.channel >= 2 && pkg.channel <= 8)
			for (const [value, , type] of pkg.notes)
				if (value !== 0 && type % 4 !== 3)
					notes++;
	}

	return { events, notes, measures: maxMeasure + 1, packages: packages.length };
}

/** Serializes one difficulty's pakcages. */
function buildSection(packages: FixturePackage[]): Uint8Array {
	let size = 0;
	for (const pkg of packages)
		size += 8 + ("values" in pkg ? pkg.values.length : pkg.notes.length) * 4;

	const bytes = new Uint8Array(size);
	const view = new DataView(bytes.buffer);
	let offset = 0;

	for (const pkg of packages) {
		const count = "values" in pkg ? pkg.values.length : pkg.notes.length;
		view.setInt32(offset, pkg.measure, true);
		view.setInt16(offset + 4, pkg.channel, true);
		view.setInt16(offset + 6, count, true);
		offset += 8;

		if ("values" in pkg)
			for (const value of pkg.values) {
				view.setFloat32(offset, value, true);
				offset += 4;
			}
		else
			for (const [value, volumePan, type] of pkg.notes) {
				view.setInt16(offset, value, true);
				view.setUint8(offset + 2, volumePan);
				view.setUint8(offset + 3, type);
				offset += 4;
			}
	}

	return bytes;
}

/** Writes a NUL-padded fixed-width string field, truncating content that overflows. */
function writeFixedString(bytes: Uint8Array, offset: number, width: number, content: Uint8Array) {
	bytes.set(content.subarray(0, width), offset);
}

/** Builds a complete .ojn image, auto-computing section offsets and header counts. */
export function buildOjn(over: FixtureOptions = {}): ArrayBuffer {
	const difficulties = over.difficulties ?? [{ packages: [] }, { packages: [] }, { packages: [] }];
	const sections = difficulties.map(difficulty => buildSection(difficulty.packages));
	const bytes = new Uint8Array(HEADER_SIZE + sections.reduce((sum, section) => sum + section.length, 0));
	const view = new DataView(bytes.buffer);

	const noteOffsets: number[] = [];
	let offset = HEADER_SIZE;
	for (const section of sections) {
		noteOffsets.push(offset);
		bytes.set(section, offset);
		offset += section.length;
	}

	view.setInt32(4, SIGNATURE, true);
	view.setFloat32(8, over.encodeVersion ?? 2.9, true);
	view.setFloat32(0x10, over.bpm ?? 120, true);

	const levels = over.levels ?? [1, 5, 10];
	for (let d = 0; d < 3; d++)
		view.setInt16(0x14 + d * 2, levels[d] ?? 0, true);

	for (let d = 0; d < 3; d++) {
		const stats = countSection(difficulties[d]!.packages);
		view.setInt32(0x1c + d * 4, over.counts?.events?.[d] ?? stats.events, true);
		view.setInt32(0x28 + d * 4, over.counts?.notes?.[d] ?? stats.notes, true);
		view.setInt32(0x34 + d * 4, over.counts?.measures?.[d] ?? stats.measures, true);
		view.setInt32(0x40 + d * 4, over.counts?.packages?.[d] ?? stats.packages, true);
	}

	writeFixedString(bytes, 0x6c, 64, over.titleBytes ?? new TextEncoder().encode(over.title ?? "Sample OJN"));
	writeFixedString(bytes, 0xac, 32, new TextEncoder().encode(over.artist ?? "artist"));
	writeFixedString(bytes, 0xcc, 32, new TextEncoder().encode(over.noter ?? "noter"));

	const durations = over.durations ?? [0, 0, 0];
	for (let d = 0; d < 3; d++) {
		view.setInt32(0x110 + d * 4, durations[d] ?? 0, true);
		view.setInt32(0x11c + d * 4, noteOffsets[d] ?? 0, true);
	}
	view.setInt32(0x128, offset, true);

	return bytes.buffer;
}
