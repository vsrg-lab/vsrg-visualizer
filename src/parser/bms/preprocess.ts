/** Random source for #RANDOM/#SWITCH: must return an integer in 1..max. */
export type Rng = (max: number) => number;

/** Branch resolution result: surviving lines and whether any control statement was used. */
export type Resolved = { lines: string[]; usedRandom: boolean };

/** A #SWITCH scope: the rolled value and whether the current #CASE section emits lines. */
type SwitchContext = { value: number; active: boolean };

const CONTROL = /^#([A-Za-z]+)(?:\s+(-?\d+))?\s*$/;

/**
 * Evaluates #RANDOM/#SETRANDOM/#SWITCH control flow and returns only the surviving lines.
 * Control statements are interpreted even inside skipped blocks, and #RANDOM/#SWITCH
 * always consume rng - matching bms-js so differential tests stay comparable.
 */
export function resolveBranches(text: string, rng: Rng): Resolved {
	const randomStack: number[] = [];
	const switchStack: SwitchContext[] = [];
	const skipStack: boolean[] = [];

	let usedRandom = false;
	const lines: string[] = [];

	for (const rawLine of text.split(/\r\n|\r|\n/)) {
		const line = rawLine.trim();
		const control = CONTROL.exec(line);
		if (control) {
			const keyword = control[1]!.toUpperCase();
			const argument = control[2] !== undefined ? Number(control[2]) : undefined;
			if (keyword === "RANDOM" && argument !== undefined) {
				randomStack.push(rng(argument));
				usedRandom = true;
				continue;
			}

			if (keyword === "SETRANDOM" && argument !== undefined) {
				randomStack.push(argument);
				usedRandom = true;
				continue;
			}

			if (keyword === "IF") {
				const random = randomStack.at(-1);
				skipStack.push(random === undefined || random !== argument);
				continue;
			}

			if (keyword === "ENDIF") {
				skipStack.pop();
				continue;
			}

			if (keyword === "ENDRANDOM") {
				randomStack.pop();
				continue;
			}

			if (keyword === "SWITCH" && argument !== undefined) {
				switchStack.push({ value: rng(argument), active: false });
				usedRandom = true;
				continue;
			}

			if (keyword === "CASE" && argument !== undefined) {
				const context = switchStack.at(-1);
				if (context !== undefined)
					context.active = context.value === argument;
				continue;
			}

			if (keyword === "SKIP") {
				const context = switchStack.at(-1);
				if (context !== undefined)
					context.active = false;
				continue;
			}

			if (keyword === "ENDSW") {
				switchStack.pop();
				continue;
			}
		}

		if (skipStack.every(flag => !flag) && switchStack.every(context => context.active))
			lines.push(line);
	}

	return { lines, usedRandom };
}
