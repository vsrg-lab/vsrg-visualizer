/** A parse failure tied to a 1-based source line. */
export type ParseError = { line: number; message: string };

/** A non-fatal problem found while parsing or compiling. Collected, never thrown. */
export type Warning = { line?: number; code: string;  message: string };

/** A single playable note. Holds use startMs/endMs; point notes use timeMs. */
export type Note =
	| { kind: "tap" | "mine" | "fake"; timeMs: number; lane: number }
	| { kind: "hold"; lane: number; startMs: number; endMs: number };

/** Time signature, e.g. 4/4. */
export type Meter = { beats: number; noteValue: number };

/** A timing/BPM change point with optional scroll-velocity multiplier. */
export type TimingPoint = { timeMs: number; bpm: number; meter: Meter; multiplier: number };

/** A rendered beat line; measure lines (downbeats) are drawn more prominently. */
export type BeatLine = { timeMs: number; isMeasure: boolean };

/** Song/chart identity. */
export type Metadata = { original: string; title: string; artist: string; creator: string; version: string };

/** Key configuration; specialLanes are 0-indexed (e.g. scratch). stages is 2 for double-play charts. */
export type Layout = { totalKeys: number; normalKeys: number; specialLanes: number[]; stages: 1 | 2 };

/** How scroll speed was derived, so flattenScroll can undo the SV part of the multiplier. */
export type ScrollInfo = { bpmAffectsScroll: boolean; baseBpm: number };

/** Fully compiled chart - the single model the renderer consumes. */
export type Chart = {
	metadata: Metadata;
	layout: Layout;
	timing: TimingPoint[];
	notes: Note[];
	beatLines: BeatLine[];
	scroll: ScrollInfo;
};

/** Which format a file came from. */
export type SourceFormat = "urc" | "osu" | "qua" | "sm" | "bms" | "ojn";

/** What one file produces. SM/O2Jam yield several charts; Qua/Osu/Urc yield one. */
export type ChartSet = { sourceFormat: SourceFormat; charts: Chart[]; warnings: Warning[] };

/** Outcome of loading a file: a chart set, or line-sorted fatal errors. */
export type LoadResult =
	| { ok: true; set: ChartSet }
	| { ok: false; errors: ParseError[] };
