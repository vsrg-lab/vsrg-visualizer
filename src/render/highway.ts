import { Container, Graphics } from "pixi.js";

import { buildScrollModel, screenY, type ScrollModel } from "../engine/scroll";
import type { BeatLine, Chart, Note } from "../model/types";
import { DARK_PALETTE, type HighwayPalette } from "../theme";

/** Static geometry of the highway. pxPerUnit (scroll speed) is supplied per-frame to render(). */
export type HighwayOptions = { laneWidth: number; receptorY: number; height: number; palette?: HighwayPalette };

const NOTE_HEIGHT = 14;

/** Renders as SV-aware down-scroll note highway into a Pixi container. */
export class Highway {
	private chart: Chart;
	private opts: HighwayOptions;
	private palette: HighwayPalette;
	private scroll: ScrollModel;
	private beats: BeatLine[];

	private statics = new Graphics();
	private dynamic = new Graphics();

	constructor(stage: Container, chart: Chart, opts: HighwayOptions) {
		this.chart = chart;
		this.opts = opts;
		this.palette = opts.palette ?? DARK_PALETTE;
		this.scroll = buildScrollModel(chart.timing);
		this.beats = chart.beatLines;

		stage.addChild(this.statics);
		stage.addChild(this.dynamic);

		this.drawStatic();
	}

	private laneX(lane: number): number {
		return lane * this.opts.laneWidth;
	}

	private width(): number {
		return this.chart.layout.totalKeys * this.opts.laneWidth;
	}

	private drawStatic(): void {
		const g = this.statics;
		const w = this.width();

		for (let lane = 0; lane <= this.chart.layout.totalKeys; lane++)
			g.rect(this.laneX(lane), 0, 1, this.opts.height).fill({ color: this.palette.laneSeparator });

		for (const lane of this.chart.layout.specialLanes)
			g.rect(this.laneX(lane), 0, this.opts.laneWidth, this.opts.height).fill({ color: this.palette.laneFill, alpha: 0.5 });

		g.rect(0, this.opts.receptorY, w, 3).fill({ color: this.palette.receptor });
	}

	render(timeMs: number, pxPerUnit: number): void {
		const g = this.dynamic;
		g.clear();

		const head = this.scroll.positionAt(timeMs);
		const w = this.width();

		for (const b of this.beats) {
			const y = screenY(this.scroll.positionAt(b.timeMs), head, pxPerUnit, this.opts.receptorY);
			if (y < 0 || y > this.opts.height)
				continue;
			g.rect(0, y, w, b.isMeasure ? 2 : 1).fill({ color: b.isMeasure ? this.palette.measureLine : this.palette.beatLine });
		}

		for (const n of this.chart.notes)
			this.drawNote(g, n, head, pxPerUnit);
	}

	private drawNote(g: Graphics, n: Note, head: number, pxPerUnit: number): void {
		const x = this.laneX(n.lane) + 2;
		const w = this.opts.laneWidth - 4;
		if (n.kind === "hold") {
			const yStart = screenY(this.scroll.positionAt(n.startMs), head, pxPerUnit, this.opts.receptorY);
			const yEnd = screenY(this.scroll.positionAt(n.endMs), head, pxPerUnit, this.opts.receptorY);
			const top = Math.min(yStart, yEnd);
			const h = Math.abs(yStart - yEnd);

			if (top + h < 0 || top > this.opts.height)
				return;

			g.rect(x, top, w, h).fill({ color: this.palette.hold });
			return;
		}

		const y = screenY(this.scroll.positionAt(n.timeMs), head, pxPerUnit, this.opts.receptorY) - NOTE_HEIGHT;
		if (y + NOTE_HEIGHT < 0 || y > this.opts.height)
			return;

		const color = n.kind === "mine" ? this.palette.mine : n.kind === "fake" ? this.palette.fake : this.palette.tap;
		g.rect(x, y, w, NOTE_HEIGHT).fill({ color, alpha: n.kind === "fake" ? 0.5 : 1 });
	}

	destroy(): void {
		this.statics.destroy();
		this.dynamic.destroy();
	}
}
