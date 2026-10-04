// Mistral-API: ein kurzer Chat-Aufruf und ein Verbindungstest.
import { CONFIG } from "../config.ts";
import { T } from "../i18n/index.ts";

export const aiConfigured = () => !!CONFIG.mistral.apiKey;

export async function askMistral(content: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.mistral.apiKey}` },
    body: JSON.stringify({ model: CONFIG.mistral.model, temperature: 0.9, max_tokens: maxTokens, messages: [{ role: "user", content }] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const body: any = await res.json().catch(() => ({}));
    throw new Error(`Mistral ${res.status}: ${body.message ?? body.detail ?? res.statusText}`);
  }
  const data: any = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

/** Prüft Schlüssel und Modell mit einer winzigen Anfrage. Gibt die Antwort oder einen Fehler zurück. */
export async function testAi(): Promise<{ ok: true; sample: string } | { ok: false; reason: "noKey" | "failed"; detail?: string }> {
  if (!CONFIG.mistral.apiKey) return { ok: false, reason: "noKey" };
  try { return { ok: true, sample: (await askMistral(T.prompt.test, 60)).slice(0, 200) }; }
  catch (e: any) { return { ok: false, reason: "failed", detail: String(e?.message ?? e) }; }
}
