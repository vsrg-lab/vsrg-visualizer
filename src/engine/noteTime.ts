import type { Note } from "../model/types";

/** Head time of a note - the key notes are sorted by. */
export function noteStartMs(note: Note): number {
	return note.kind === "hold" ? note.startMs : note.timeMs;
}

/** End time of a note; point notes end where they start. */
export function noteEndMs(note: Note): number {
	return note.kind === "hold" ? note.endMs : note.timeMs;
}
