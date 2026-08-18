/** Minimal type surface of the bms (bms-js) package, used only by differential tests. */
declare module "bms" {
	export namespace Compiler {
		function compile(text: string, options?: { rng?: (max: number) => number }): {
			chart: {
				objects: {
					allSorted(): { measure: number; fraction: number; value: string; channel: string; lineNumber: number }[];
				};
				timeSignatures: { get(measure: number): number };
				measureToBeat(measure: number, fraction: number): number;
			};
			warnings: unknown[];
		};
	}
}
