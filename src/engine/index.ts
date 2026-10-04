// Öffentliche Schnittstelle der Engine. Alles außerhalb von src/engine importiert nur von hier.
export * from "./state.ts";
export { newGame } from "./setup.ts";
export { resolveDay } from "./resolve.ts";
export { validateMove, RuleError } from "./validate.ts";
export type { RuleErrorCode } from "./validate.ts";
