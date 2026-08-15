/** Playback clock driven by an injectable time source (performance.now in the app, fake in tests). */
export class Clock {
	private readonly now: () => number;
	private baseMs: number;
	private baseReal: number;
	private _playing = false;
	private _rate = 1;

	constructor(now: () => number, startMs = 0) {
		this.now = now;
		this.baseMs = startMs;
		this.baseReal = this.now();
	}

	/** Current playback time in ms. */
	get timeMs(): number {
		if (!this._playing)
			return this.baseMs;
		return this.baseMs + (this.now() - this.baseReal) * this._rate;
	}

	get playing(): boolean {
		return this._playing;
	}

	get rate(): number {
		return this._rate;
	}

	play(): void {
		if (this._playing)
			return;

		this.baseReal = this.now();
		this._playing = true;
	}

	pause(): void {
		this.baseMs = this.timeMs;
		this._playing = false;
	}

	seek(ms: number): void {
		this.baseMs = ms;
		this.baseReal = this.now();
	}

	setRate(rate: number): void {
		this.baseMs = this.timeMs;
		this.baseReal = this.now();
		this._rate = rate;
	}
}
