const two = (value: number): string => String(value).padStart(2, "0");

/** Elapsed-clock format "m:ss", or "h:mm:ss" past an hour. */
export function formatClock(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;

	return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${minutes}:${two(seconds)}`;
}

/** The same clock with centiseconds, for the playhead and the timing rows. */
export function formatClockCentis(ms: number): string {
	const safe = Math.max(0, ms);
	return `${formatClock(safe)}.${two(Math.floor(safe % 1000 / 10))}`;
}

/** Thousands-separated integer, so note counts stay comparable at a glance. */
export function formatCount(value: number): string {
	return value.toLocaleString("en-US");
}
