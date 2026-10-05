// Öffentliche Schnittstelle der Engine. Alles außerhalb von src/engine importiert nur von hier.
export * from "./state.ts";
export { newGame } from "./setup.ts";
export { resolveDay } from "./resolve.ts";
export { validateMove, RuleError } from "./validate.ts";
export { transfer, reservedPk, freePk, cleanSubject, SUBJECT_MAX } from "./transfer.ts";
export type { Transfer } from "./transfer.ts";
export type { RuleErrorCode } from "./validate.ts";
