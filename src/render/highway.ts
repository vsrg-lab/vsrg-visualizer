import { Container, Graphics } from "pixi.js";

import { highwayGeometry, laneX, visibleNoteRange, type HighwayGeometry } from "./geometry";
import { drawFake, drawHold, drawMine, drawTap, noteMetrics, type NoteMetrics } from "./notes";
import { laneRoles } from "./palette";
import { buildScrollModel, screenY, type ScrollModel } from "../engine/scroll";
import type { BeatLine, Chart, Note } from "../model/types";
import { type HighwayPalette } from "../theme";

/** Static geometry of the highway. pxPerUnit (scroll speed) is supplied per-frame to render(). */
export type HighwayOptions = {
	canvasWidth: number;
	laneWidth: number;
	receptorY: number;
	height: number;
	palette: HighwayPalette;
};

/** Multiplier floor for the visibility window. */
const MIN_MULT_FLOOR = 0.2;
/** Extra scroll-units of slack added to both visibility bounds. */
const VISIBILITY_SLACK_UNITS = 200;
/** Cap on the forward visibility window so slow-SV charts keep some culling benefit. */
const AHEAD_CAP_MS = 60_000;

/** Renders an SV-aware down-scroll note highway into a Pixi container. */
export class Highway {
	private chart: Chart;
	private opts: HighwayOptions;
	private scroll: ScrollModel;
	private beats: BeatLine[];
	private geo: HighwayGeometry;
	private metrics: NoteMetrics;
	private laneColors: number[];
	private laneFills: number[];
	private maxHoldMs: number;
	private minMultiplier: number;

	private lastTimeMs = NaN;
	private lastPxPerUnit = NaN;

	private statics = new Graphics();
	private dynamic = new Graphics();

	constructor(stage: Container, chart: Chart, opts: HighwayOptions) {
		this.chart = chart;
		this.opts = opts;
		this.scroll = buildScrollModel(chart.timing);
		this.beats = chart.beatLines;
		this.geo = highwayGeometry(opts.canvasWidth, opts.laneWidth, chart.layout);
		this.metrics = noteMetrics(opts.laneWidth);

		const roleNote = { a: "laneA", b: "laneB", special: "laneSpecial" } as const;
		const roleFill = { a: "laneAFill", b: "laneBFill", special: "laneSpecialFill" } as const;
		const roles = laneRoles(chart.layout);
		this.laneColors = roles.map(role => this.opts.palette[roleNote[role]]);
		this.laneFills = roles.map(role => this.opts.palette[roleFill[role]]);

		this.maxHoldMs = chart.notes.reduce((max, n) => n.kind === "hold" ? Math.max(max, n.endMs - n.startMs) : max, 0);
		this.minMultiplier = Math.max(MIN_MULT_FLOOR, chart.timing.reduce((min, p) => Math.min(min, p.multiplier), Infinity));

		stage.addChild(this.statics);
		stage.addChild(this.dynamic);

		this.drawStatic();
	}

	private drawStatic(): void {
		const g = this.statics;
		const geo = this.geo;

		for (let lane = 0; lane < this.chart.layout.totalKeys; lane++)
			g.rect(laneX(geo, lane), 0, geo.laneWidth, this.opts.height)
				.fill({ color: this.laneFills[lane], alpha: 0.55 });

		for (let lane = 0; lane <= this.chart.layout.totalKeys; lane++)
			g.rect(laneX(geo, lane), 0, 1, this.opts.height)
				.fill({ color: this.opts.palette.laneSeparator });

		if (this.chart.layout.stages === 2)
			g.rect(geo.originX + geo.stageSplit * geo.laneWidth + geo.stageGap / 2, 0, 2, this.opts.height)
				.fill({ color: this.opts.palette.stageSeparator });

		for (let lane = 0; lane < this.chart.layout.totalKeys; lane++)
			g.rect(laneX(geo, lane), this.opts.receptorY - 6, geo.laneWidth, 12)
				.fill({ color: this.laneColors[lane], alpha: 0.35 });

		g.rect(geo.originX, this.opts.receptorY, geo.totalWidth, 2)
			.fill({ color: this.opts.palette.receptor });
	}

	render(timeMs: number, pxPerUnit: number): void {
		// Graphics keep their geometry between frames, so an unchanged frame needs no rebuild.
		if (timeMs === this.lastTimeMs && pxPerUnit === this.lastPxPerUnit)
			return;

		this.lastTimeMs = timeMs;
		this.lastPxPerUnit = pxPerUnit;

		const g = this.dynamic;
		g.clear();

		const head = this.scroll.positionAt(timeMs);

		for (const b of this.beats) {
			const y = screenY(this.scroll.positionAt(b.timeMs), head, pxPerUnit, this.opts.receptorY);
			if (y < 0 || y > this.opts.height)
				continue;
			g.rect(this.geo.originX, y, this.geo.totalWidth, b.isMeasure ? 2 : 1)
				.fill({ color: b.isMeasure ? this.opts.palette.measureLine : this.opts.palette.beatLine });
		}

		const behindMs = ((this.opts.height - this.opts.receptorY) / pxPerUnit + VISIBILITY_SLACK_UNITS) / this.minMultiplier;
		const aheadMs = Math.min((this.opts.receptorY / pxPerUnit + VISIBILITY_SLACK_UNITS) / this.minMultiplier, AHEAD_CAP_MS);
		const [start, end] = visibleNoteRange(this.chart.notes, timeMs - this.maxHoldMs - behindMs, timeMs + aheadMs);

		for (let i = start; i < end; i++)
			this.drawNote(g, this.chart.notes[i], head, pxPerUnit);
	}

	private drawNote(g: Graphics, n: Note, head: number, pxPerUnit: number): void {
		const x = laneX(this.geo, n.lane) + this.metrics.inset;
		const w = this.opts.laneWidth - this.metrics.inset * 2;
		const color = this.laneColors[n.lane];

		if (n.kind === "hold") {
			const startY = screenY(this.scroll.positionAt(n.startMs), head, pxPerUnit, this.opts.receptorY);
			const endY = screenY(this.scroll.positionAt(n.endMs), head, pxPerUnit, this.opts.receptorY);

			if (Math.max(startY, endY) + this.metrics.tapHeight < 0 || Math.min(startY, endY) - this.metrics.tapHeight > this.opts.height)
				return;

			drawHold(g, x, w, startY, endY, this.metrics, color);
			return;
		}

		const y = screenY(this.scroll.positionAt(n.timeMs), head, pxPerUnit, this.opts.receptorY) - this.metrics.tapHeight;
		if (y + this.metrics.tapHeight < 0 || y > this.opts.height)
			return;

		if (n.kind === "mine")
			drawMine(g, x, y, w, this.metrics, this.opts.palette.mine);
		else if (n.kind === "fake")
			drawFake(g, x, y, w, this.metrics, this.opts.palette.fake);
		else
			drawTap(g, x, y, w, this.metrics, color);
	}

	destroy(): void {
		this.statics.destroy();
		this.dynamic.destroy();
	}
}
