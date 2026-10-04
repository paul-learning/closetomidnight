// Aktive Sprache. Für Englisch: src/i18n/en/ anlegen und hier umschalten.
import { DE } from "./de/index.ts";
export const T = DE;
export type Strings = typeof DE;
export { fmt } from "./fmt.ts";
