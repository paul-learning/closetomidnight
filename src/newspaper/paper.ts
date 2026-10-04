// Die Tageszeitung. Die KI schreibt nur Text; alle Zahlen kommen aus der Engine.
// Ohne Mistral-Schlüssel oder bei Fehlern gibt es die schlichte Zusammenfassung.
import type { DayReport, GameState } from "../engine/index.ts";
import { aiConfigured, askMistral } from "../integrations/mistral.ts";
import { prompt } from "./prompt.ts";
import { plainSummary } from "./summary.ts";

export async function writePaper(s: GameState, r: DayReport): Promise<string> {
  if (!aiConfigured()) return plainSummary(s, r);
  try {
    const text = await askMistral(prompt(s, r), 600);
    return text ? `🗞 ${text}` : plainSummary(s, r);
  } catch (e) {
    console.error("KI-Zeitung fehlgeschlagen, nutze Zusammenfassung:", e);
    return plainSummary(s, r);
  }
}
