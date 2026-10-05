// KI über eine OpenAI-kompatible Schnittstelle (Gemini, Mistral, Groq, OpenRouter, Ollama, …):
// ein kurzer Chat-Aufruf und ein Verbindungstest. Einstellungen: CONFIG.ai (siehe config.ts).
import { CONFIG } from "../config.ts";
import { T } from "../i18n/index.ts";

export const aiConfigured = () => CONFIG.ai.problem === null;
export const aiLabel = () => `${CONFIG.ai.provider}, ${CONFIG.ai.model}`;

export async function askAi(content: string, maxTokens: number, ai: Pick<typeof CONFIG.ai, "baseUrl" | "apiKey" | "model" | "provider"> = CONFIG.ai): Promise<string> {
  const { baseUrl, apiKey, model, provider } = ai;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, temperature: 0.9, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${errorText(await res.json().catch(() => null)) ?? res.statusText}`);
  const data: any = await res.json();
  const text = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new Error(`${provider}: leere Antwort (${data.choices?.[0]?.finish_reason ?? "unbekannt"})`);
  return text;
}

/** Die Anbieter verpacken Fehler unterschiedlich; nimm die erste lesbare Meldung. */
function errorText(body: any): string | undefined {
  const b = Array.isArray(body) ? body[0] : body;
  const m = b?.error?.message ?? b?.message ?? b?.detail ?? b?.error;
  return typeof m === "string" ? m.slice(0, 300) : undefined;
}

/** Prüft Schlüssel und Modell mit einer winzigen Anfrage. Gibt die Antwort oder einen Fehler zurück. */
export async function testAi(): Promise<{ ok: true; sample: string } | { ok: false; reason: "noKey" | "failed"; detail?: string }> {
  if (!aiConfigured()) return { ok: false, reason: "noKey", detail: CONFIG.ai.problem ?? undefined };
  // großzügig, weil manche Modelle (z. B. Gemini) erst „nachdenken“ und das mitzählt
  try { return { ok: true, sample: (await askAi(T.prompt.test, 1000)).slice(0, 200) }; }
  catch (e: any) { return { ok: false, reason: "failed", detail: String(e?.message ?? e) }; }
}
