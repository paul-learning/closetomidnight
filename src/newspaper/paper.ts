// Die Tageszeitung. Die KI schreibt nur Text; alle Zahlen kommen aus der Engine.
// Ohne eingerichtete KI oder bei Fehlern gibt es die schlichte Zusammenfassung.
import type { DayReport, GameState } from "../engine/index.ts";
import { aiConfigured, askAi } from "../integrations/ai.ts";
import { prompt } from "./prompt.ts";
import { plainSummary } from "./summary.ts";

export async function writePaper(s: GameState, r: DayReport): Promise<string> {
  if (!aiConfigured()) return plainSummary(s, r);
  try {
    // großzügig: Modelle mit „Nachdenken“ (z. B. Gemini) zählen das mit; die Länge steuert der Auftrag
    const text = await askAi(prompt(s, r), 2000);
    return text ? `🗞 ${text}` : plainSummary(s, r);
  } catch (e) {
    console.error("KI-Zeitung fehlgeschlagen, nutze Zusammenfassung:", e);
    return plainSummary(s, r);
  }
}
