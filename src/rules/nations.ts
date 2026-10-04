// Sonderfähigkeiten der Nationen als Daten. Die Engine fragt nur diese Werte ab, nie den Namen einer Nation.
import type { NationId } from "./types.ts";

export interface NationRules {
  startBonusPk: number; // zusätzlicher Einfluss beim Start
  warCardDiscount: number; // Rabatt auf Karten, die Krieg betreffen
  veto: boolean; // einmal pro Spiel einen Ratsbeschluss kippen
  foresight: boolean; // sieht die Krise von morgen
}

const none: NationRules = { startBonusPk: 0, warCardDiscount: 0, veto: false, foresight: false };

export const NATION_RULES: Record<NationId, NationRules> = {
  teutonien: { ...none, startBonusPk: 2 },
  gallien: { ...none, veto: true },
  polonien: { ...none, warCardDiscount: 1 },
  italica: { ...none, foresight: true },
};
