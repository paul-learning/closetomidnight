// Ortszeit der Spielgruppe (Standard: Berlin).
import { CONFIG } from "../config.ts";

export function localNow(): { date: string; hour: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("de-DE", {
    timeZone: CONFIG.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 };
}
