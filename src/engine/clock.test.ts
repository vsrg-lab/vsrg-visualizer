import { describe, it, expect } from "vitest";

import { Clock } from "./clock";

describe("Clock", () => {
	it("does not advance until played", () => {
		let t = 0;
		const c = new Clock(() => t);
		t = 500;
		expect(c.timeMs).toBe(0);
	});

	it("advances with real time while playing", () => {
		let t = 0;
		const c = new Clock(() => t);
		c.play();
		t = 500;
		expect(c.timeMs).toBe(500);
	});

	it("freezes time on pause", () => {
		let t = 0;
		const c = new Clock(() => t);
		c.play();
		t = 300;
		c.pause();
		t = 999;
		expect(c.timeMs).toBe(300);
	});

	it("applies rate after the change point", () => {
		let t = 0;
		const c = new Clock(() => t);
		c.play();
		t = 100;
		c.setRate(2);
		t = 200;
		expect(c.timeMs).toBe(100 + 100 * 2);
	});

	it("seeks to an absolute time", () => {
		const t = 50;
		const c = new Clock(() => t);
		c.seek(1000);
		expect(c.timeMs).toBe(1000);
	});
});
