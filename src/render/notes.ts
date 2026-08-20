import type { Graphics } from "pixi.js";

import { darken } from "../theme";

/** Note skin metrics derived from the lane width. */
export type NoteMetrics = {
	/** Tap/LN head height, clamped so narrow lanes do not collapse into threads. */
	tapHeight: number;
	/** Corner radius of rounded note bars. */
	radius: number;
	/** Inset from the lane edge on each side. */
	inset: number;
};

/** Derives note skin metrics from the lane width. */
export function noteMetrics(laneWidth: number): NoteMetrics {
	return {
		tapHeight: Math.min(Math.max(laneWidth * 0.35, 10), 22),
		radius: Math.min(4, laneWidth * 0.12),
		inset: Math.max(2, laneWidth * 0.04)
	};
}

/** Draws a tap: a rounded bar with a thin top highlight strip. */
export function drawTap(g: Graphics, x: number, y: number, w: number, m: NoteMetrics, color: number): void {
	g.roundRect(x, y, w, m.tapHeight, m.radius).fill({ color });
	g.rect(x + 1, y + 1, Math.max(w - 2, 1), Math.max(Math.floor(m.tapHeight * 0.15), 1)).fill({ color: 0xffffff, alpha: 0.22 });
}

/** Draws a hold between its head and tail y positions. */
export function drawHold(
	g: Graphics,
	x: number,
	w: number,
	startY: number,
	endY: number,
	m: NoteMetrics,
	color: number
): void {
	const bodyTop = endY;
	const bodyBottom = startY - m.tapHeight;
	if (bodyBottom > bodyTop)
		g.rect(x, bodyTop, w, bodyBottom - bodyTop)
			.fill({ color: darken(color, 0.55) });

	drawTap(g, x, startY - m.tapHeight, w, m, color);
	drawTap(g, x, endY - m.tapHeight, w, m, color);
}

/** Draws a mine as a filled circle. */
export function drawMine(g: Graphics, x: number, y: number, w: number, m: NoteMetrics, color: number): void {
	g.circle(x + w / 2, y + m.tapHeight / 2, Math.min(w, m.tapHeight) / 2)
		.fill({ color });
}

/** Draws a fake note. */
export function drawFake(g: Graphics, x: number, y: number, w: number, m: NoteMetrics, color: number): void {
	g.roundRect(x, y, w, m.tapHeight, m.radius)
		.fill({ color, alpha: 0.15 })
		.stroke({ color, width: 1, alpha: 0.8 });
}
