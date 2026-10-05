// KI über eine OpenAI-kompatible Schnittstelle (Gemini, Mistral, Groq, OpenRouter, Ollama, …):
// ein kurzer Chat-Aufruf und ein Verbindungstest. Einstellungen: CONFIG.ai (siehe config.ts).
import { CONFIG } from "../config.ts";
import { T } from "../i18n/index.ts";
import { toPlainText } from "../newspaper/plainText.ts";

type AiSettings = Pick<typeof CONFIG.ai, "baseUrl" | "apiKey" | "model" | "provider" | "extraBody" | "minTokens" | "retryDelayMs">;

export const aiConfigured = () => CONFIG.ai.problem === null;
export const aiLabel = () => `${CONFIG.ai.provider}, ${CONFIG.ai.model}`;

class AiError extends Error {
  /** Vorübergehend (Überlastung, Kontingent, Netz): ein zweiter Versuch kann klappen. */
  transient: boolean;
  status: number;
  constructor(message: string, status: number, transient: boolean) { super(message); this.status = status; this.transient = transient; }
}

/**
 * Eine Frage, eine Antwort. Bei vorübergehenden Fehlern (429, 5xx, Zeitüberschreitung) wird nach
 * retryDelayMs einmal neu gefragt – das Gratis-Kontingent von Gemini ist manchmal kurz überlastet.
 */
export async function askAi(content: string, maxTokens: number, opts: { retry?: boolean } = {}, ai: AiSettings = CONFIG.ai): Promise<string> {
  try { return await askOnce(content, maxTokens, ai); }
  catch (e) {
    if (!(opts.retry ?? true) || !(e instanceof AiError && e.transient)) throw e;
    await new Promise(ok => setTimeout(ok, ai.retryDelayMs));
    return askOnce(content, maxTokens, ai);
  }
}

async function askOnce(content: string, maxTokens: number, ai: AiSettings, withExtra = true): Promise<string> {
  const { baseUrl, apiKey, model, provider } = ai;
  const extra = withExtra ? ai.extraBody : undefined;
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({
        model, temperature: 0.9, max_tokens: Math.max(maxTokens, ai.minTokens), messages: [{ role: "user", content }], ...extra,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e: any) {
    throw new AiError(`${provider}: keine Verbindung (${e?.name === "TimeoutError" ? "Zeitüberschreitung" : e?.message ?? e})`, 0, true);
  }
  const raw = await res.text();
  let data: any = null;
  try { data = JSON.parse(raw); } catch { /* unten gemeldet */ }
  if (!res.ok) {
    // Ein Modell kennt ein Zusatzfeld (z. B. reasoning_effort) nicht: einmal ohne versuchen
    if (res.status === 400 && extra) return askOnce(content, maxTokens, ai, false);
    const transient = res.status === 429 || res.status >= 500;
    throw new AiError(`${provider} ${res.status}: ${errorText(data) ?? (data ? res.statusText : "keine JSON-Antwort")}`, res.status, transient);
  }
  if (!data) throw new AiError(`${provider} ${res.status}: keine JSON-Antwort`, res.status, false);
  const text = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!text) throw new AiError(`${provider}: leere Antwort (${data.choices?.[0]?.finish_reason ?? "unbekannt"})`, res.status, false);
  return text;
}

/** Die Anbieter verpacken Fehler unterschiedlich; nimm die erste lesbare Meldung. */
function errorText(body: any): string | undefined {
  const b = Array.isArray(body) ? body[0] : body;
  const m = b?.error?.message ?? b?.message ?? b?.detail ?? b?.error;
  return typeof m === "string" ? m.slice(0, 300) : undefined;
}

/** Prüft Schlüssel und Modell mit einer kleinen Anfrage, ohne zweiten Versuch (schnelle Rückmeldung). */
export async function testAi(): Promise<{ ok: true; sample: string } | { ok: false; reason: "notSet" | "failed"; detail?: string }> {
  if (CONFIG.ai.problem) return { ok: false, reason: "notSet", detail: CONFIG.ai.problem };
  try { return { ok: true, sample: toPlainText(await askAi(T.prompt.test, 1000, { retry: false })).slice(0, 200) }; }
  catch (e: any) { return { ok: false, reason: "failed", detail: String(e?.message ?? e) }; }
}
