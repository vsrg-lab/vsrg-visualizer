import type { Layout, Metadata, ParseError, Warning } from "./types";

/** A point on the source time axis. Its unit is decided by SourceChart.timeAxis. */
type At = { at: number };

/** How long a stop lasts. StepMania states stops in seconds, BMS in beats. */
export type Duration = { unit: "ms"; value: number } | { unit: "beats"; value: number };

/** A timing change expressed in the source format's own terms. */
export type TimingEvent =
	| ({ kind: "bpm"; bpm: number } & At)
	| ({ kind: "meter"; beats: number; noteValue: number } & At)
	| ({ kind: "sv"; multiplier: number } & At)
	| ({ kind: "stop"; duration: Duration } & At)
	| ({ kind: "warp"; lengthBeats: number } & At);

/** A note placed on the source time axis. */
export type SourceNote =
	| ({ kind: "tap" | "mine" | "fake"; lane: number } & At)
	| { kind: "hold"; lane: number; at: number; end: number };

/**
 * A chart still expressed in its source format's time axis. Parsers produce this;
 * compileChart turns it into a Chart. Parsers do no time arithmetic.
 */
export type SourceChart = {
	metadata: Metadata;
	layout: Layout;
	timeAxis: "ms" | "beat";
	bpmAffectsScroll: boolean;
	events: TimingEvent[];
	notes: SourceNote[];
};

/** Outcome of parsing a chart document into a SourceChart. warnings is omitted by strict formats that produce none. */
export type ParseResult =
	| { ok: true; source: SourceChart; warnings?: Warning[] }
	| { ok: false; errors: ParseError[] };
