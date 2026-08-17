import { parseNoteData } from "./notedata";
import { readMsd, type MsdTag } from "./sections";
import { parseSmTiming, type FakeRegion } from "./timing";
import type { ParseResult, SourceChart, SourceNote } from "../../model/source";
import type { Layout, Metadata, Warning } from "../../model/types";

/** Lane counts for the styles this tool draws. Anything else is skipped with a warning. */
const STEPSTYPE_LANES: Record<string, number> = {
	"dance-single": 4,
	"dance-solo": 6,
	"dance-double": 8,
	"dance-couple": 8,
	"dance-routine": 8,
	"pump-single": 5,
	"pump-halfdouble": 6,
	"pump-double": 10,
	"pump-couple": 10,
	"kb7-single": 7,
	"para-single": 5,
	"techno-single4": 4,
	"techno-single5": 5,
	"techno-single8": 8,
	"techno-double4": 8,
	"techno-double5": 10
};

const DOUBLE_STYLES = /-(double|couple|routine)$/;

/** Timing tags may appear at song level and again inside a chart, where they replace outright. */
const TIMING_TAGS = ["BPMS", "STOPS", "DELAYS", "WARPS", "SCROLLS", "SPEEDS", "TIMESIGNATURES", "FAKES"];

/** One chart's raw tags plus its note data. */
type ChartBlock = {
	tags: Map<string, string>;
	stepstype: string;
	difficulty: string;
	meter: string;
	body: string;
};

function firstValue(tag: MsdTag): string {
	return (tag.values[0] ?? "").trim();
}

function songTags(tags: MsdTag[], until: number): Map<string, string> {
	const map = new Map<string, string>();
	for (let i = 0; i < until; i++)
		if (!map.has(tags[i].name))
			map.set(tags[i].name, firstValue(tags[i]));

	return map;
}

/** .sm keeps everything in one #NOTES tag: type, description, difficulty, meter, radar, note data. */
function readSmBlocks(tags: MsdTag[]): ChartBlock[] {
	const blocks: ChartBlock[] = [];

	for (const tag of tags) {
		if (tag.name !== "NOTES" || tag.values.length < 6)
			continue;

		blocks.push({
			tags: new Map(),
			stepstype: tag.values[0].trim(),
			difficulty: tag.values[2].trim(),
			meter: tag.values[3].trim(),
			body: tag.values[5]
		});
	}

	return blocks;
}

/** .ssc opens each chart with #NOTEDATA and lists its tags until the next one. */
function readSscBlocks(tags: MsdTag[], firstNoteData: number): ChartBlock[] {
	const blocks: ChartBlock[] = [];
	let current: Map<string, string> | null = null;
	let body: string | null = null;

	const flush = (): void => {
		if (current && body !== null)
			blocks.push({
				tags: current,
				stepstype: current.get("STEPSTYLE") ?? "",
				difficulty: current.get("DIFFICULTY") ?? "",
				meter: current.get("METER") ?? "",
				body
			});
	};

	for (let i = firstNoteData; i < tags.length; i++) {
		const tag = tags[i];

		if (tag.name === "NOTEDATA") {
			flush();
			current = new Map();
			body = null;
			continue;
		}

		if (!current)
			continue;

		if (tag.name === "NOTES" || tag.name === "NOTES2") {
			body = tag.values[tag.values.length - 1] ?? "";
			continue;
		}

		current.set(tag.name, firstValue(tag));
	}

	flush();
	return blocks;
}

function buildLayout(stepstype: string): Layout | null {
	const totalKeys = STEPSTYPE_LANES[stepstype];
	if (totalKeys === undefined)
		return null;

	return {
		totalKeys,
		normalKeys: totalKeys,
		specialLanes: [],
		stages: DOUBLE_STYLES.test(stepstype) ? 2 : 1
	};
}

function applyFakes(notes: SourceNote[], fakes: FakeRegion[]): SourceNote[] {
	if (fakes.length === 0)
		return notes;

	const inside = (beat: number): boolean => fakes.some(region => beat >= region.start && beat < region.end);

	return notes.map(note => inside(note.at)
		? { kind: "fake", at: note.at, lane: note.lane }
		: note);
}

/** Chart tags win over song tags, tag by tag - a chart's #BPMS replaces the song's entirely. */
function resolveTiming(song: Map<string, string>, chart: Map<string, string>): Map<string, string> {
	const resolved = new Map(song);
	for (const name of TIMING_TAGS)
		if (chart.has(name))
			resolved.set(name, chart.get(name)!);

	return resolved;
}

/** Parses a StepMania .sm or Etterna .ssc document into one source chart per note block. */
export function parseSm(text: string): ParseResult {
	const tags = readMsd(text);
	if (tags.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "no MSD tags found; not a StepMania file"
			}]
		};

	const warnings: Warning[] = [];
	const firstNoteData = tags.findIndex(tag => tag.name === "NOTEDATA");
	const isSsc = firstNoteData >= 0;

	const firstChartTag = isSsc ? firstNoteData : tags.findIndex(tag => tag.name === "NOTES");
	const song = songTags(tags, firstChartTag >= 0 ? firstChartTag : tags.length);

	const blocks = isSsc ? readSscBlocks(tags, firstNoteData) : readSmBlocks(tags);
	if (blocks.length === 0)
		return {
			ok: false,
			errors: [{
				line: 1,
				message: "file holds no chart data"
			}]
		};

	const metadata: Omit<Metadata, "version"> = {
		original: "StepMania",
		title: song.get("TITLE") ?? "",
		artist: song.get("ARTIST") ?? "",
		creator: song.get("CREDIT") ?? ""
	};

	const sources: SourceChart[] = [];
	for (const block of blocks) {
		const layout = buildLayout(block.stepstype);
		if (!layout) {
			warnings.push({
				code: "unknown-stepstype",
				message: `skipped chart with unsupported stepstype "${block.stepstype}"`
			});
			continue;
		}

		const timing = parseSmTiming(resolveTiming(song, block.tags), warnings);
		const notes = applyFakes(parseNoteData(block.body, layout.totalKeys, warnings), timing.fakes);
		if (notes.length === 0) {
			warnings.push({
				code: "empty-chart",
				message: `skipped chart "${block.difficulty}" with no notes`
			});
			continue;
		}

		const name = block.tags.get("CHARTNAME") ?? "";
		sources.push({
			metadata: {
				...metadata,
				creator: block.tags.get("CREDIT") ?? metadata.creator,
				version: [block.difficulty, block.meter].filter(part => part !== "").join(" ") || name
			},
			layout,
			timeAxis: "beat",
			bpmAffectsScroll: true,
			events: timing.events,
			notes
		});
	}

	if (sources.length === 0)
		return {
			ok: false, errors: [{
				line: 1,
				message: "no playable chart in this file"
			}]
		};

	return { ok: true, sources, warnings };
}
