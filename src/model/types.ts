/** Kind of a note event. Holds carry a start/end pair; the rest are point events. */
export type NoteKind = "tap" | "mine" | "fake" | "hold";

/** A single playable note. Holds use startMs/endMs; point notes use timeMs. */
export type Note =
	| { kind: "tap" | "mine" | "fake"; timeMs: number; lane: number }
	| { kind: "hold"; lane: number; startMs: number; endMs: number };

/** Time signature, e.g. 4/4. */
export type Meter = { beats: number; noteValue: number };

/** A timing/BPM change point with optional scroll-velocity multiplier. */
export type TimingPoint = { timeMs: number; bpm: number; meter: Meter; multiplier: number };

/** Song/chart identity. */
export type Metadata = { original: string; title: string; artist: string; creator: string; version: string };

/** Optional judgment windows (ms) and matching score rates (%). */
export type Judgment = { windows: number[]; rates: number[] };

/** Key configuration; specialLanes are 0-indexed (e.g. scratch). */
export type Layout = { totalKeys: number; normalKeys: number; specialLanes: number[] };

/** Fully parsed URC chart - the single model the renderer consumes. */
export type Chart = {
	metadata: Metadata;
	judgment?: Judgment;
	layout: Layout;
	timing: TimingPoint[];
	notes: Note[];
};
