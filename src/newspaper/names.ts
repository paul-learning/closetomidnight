// Gemeinsame Namens-Helfer für Zusammenfassung und KI-Auftrag.
import { clockTime, isMidnight } from "../engine/index.ts";
import type { DayReport, GameState } from "../engine/index.ts";
import { T } from "../i18n/index.ts";
import type { NationId, PowerId } from "../rules/types.ts";

export const nation = (n: NationId) => T.nations[n].name;
export const nations = (list?: NationId[]) => list?.length ? list.map(nation).join(", ") : T.paper.nobody;
export const crisisName = (id: string) => T.crises[id].name;
export const responseName = (crisis: string, id: string) => T.crises[crisis].responses[id];
export const power = (p: PowerId) => T.powers[p].name;
export const time = (s: GameState, r: DayReport) => isMidnight(s) ? T.paper.midnight : clockTime(r.tracksAfter);
