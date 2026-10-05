// Einstellungen und Zugangsdaten. Nur hier wird process.env gelesen. Vorlage: .env.example
// Leere Werte (z. B. "RESOLVE_HOUR=") gelten als nicht gesetzt, damit die Standardwerte greifen.
import { AI_PRESETS } from "./integrations/aiProviders.ts";

const env: Record<string, string | undefined> = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));

export const CONFIG = Object.freeze({
  port: Number(env.PORT ?? 8080),
  baseUrl: (env.BASE_URL ?? `http://localhost:${env.PORT ?? 8080}`).replace(/\/$/, ""),
  dbPath: env.DB_PATH ?? "fvz.sqlite",
  adminSecret: env.ADMIN_SECRET ?? "",
  trustProxy: env.TRUST_PROXY === "1", // hinter Caddy: echte Besucheradresse aus X-Forwarded-For
  timeZone: env.TIME_ZONE ?? "Europe/Berlin",
  resolveHour: Number(env.RESOLVE_HOUR ?? 21),
  remindHour: Number(env.REMIND_HOUR ?? 18),
  pushContact: env.PUSH_CONTACT ?? "", // Kontakt für Push-Dienste: mailto:… oder https://…; leer = BASE_URL
  ai: resolveAiConfig(env),
});

export type AiProblem = "none" | "noProvider" | "unknownProvider" | "noModel" | "noKey";

/**
 * KI für die Zeitung. AI_PROVIDER wählt eine Voreinstellung (gemini, mistral, groq, openrouter, ollama),
 * AI_BASE_URL / AI_MODEL überschreiben sie, AI_API_KEY ist der Schlüssel.
 * Ältere .env mit nur MISTRAL_API_KEY / MISTRAL_MODEL funktionieren weiter. Die alten Werte gelten aber nur
 * für Mistral: Ein neuer AI_API_KEY ohne AI_PROVIDER wird nie an Mistral geschickt.
 */
export function resolveAiConfig(env: Record<string, string | undefined>) {
  const anyNew = !!(env.AI_PROVIDER || env.AI_BASE_URL || env.AI_API_KEY || env.AI_MODEL);
  const provider = (env.AI_PROVIDER ?? (!anyNew && env.MISTRAL_API_KEY ? "mistral" : "")).toLowerCase();
  const preset = AI_PRESETS[provider];
  const mistral = provider === "mistral"; // nur dann zählen MISTRAL_API_KEY / MISTRAL_MODEL
  const baseUrl = (env.AI_BASE_URL ?? preset?.baseUrl ?? "").replace(/\/+$/, "");
  const model = env.AI_MODEL ?? (mistral ? env.MISTRAL_MODEL : undefined) ?? preset?.model ?? "";
  const apiKey = env.AI_API_KEY ?? (mistral ? env.MISTRAL_API_KEY : undefined) ?? "";
  // Ohne Voreinstellung (eigene AI_BASE_URL) ist der Schlüssel freiwillig, z. B. für lokale Modelle
  const keyRequired = preset ? preset.keyRequired : false;
  let label = provider;
  if (!label && baseUrl) { try { label = new URL(baseUrl).host; } catch { label = baseUrl; } }
  const problem: AiProblem | null =
    !provider && !baseUrl ? (anyNew ? "noProvider" : "none")
    : !baseUrl ? "unknownProvider"
    : !model ? "noModel"
    : keyRequired && !apiKey ? "noKey"
    : null;
  return Object.freeze({
    provider: label, baseUrl, model, apiKey, problem,
    // Eigene Adresse ohne Voreinstellung: keine Zusatzfelder, keine Mindestgrenze
    extraBody: env.AI_BASE_URL ? undefined : preset?.extraBody,
    minTokens: preset?.minTokens ?? 0,
    retryDelayMs: Number(env.AI_RETRY_DELAY_MS ?? 10_000),
  });
}

const AI_PROBLEM_LOG: Record<AiProblem, string> = {
  none: "KI-Zeitung aus (kein AI_PROVIDER) – schlichte Zusammenfassung",
  noProvider: "WARNUNG: KI-Zeitung aus – AI_PROVIDER fehlt (z. B. AI_PROVIDER=gemini)",
  unknownProvider: "WARNUNG: KI-Zeitung aus – AI_PROVIDER unbekannt (gemini, mistral, groq, openrouter, ollama) oder AI_BASE_URL setzen",
  noModel: "WARNUNG: KI-Zeitung aus – AI_MODEL fehlt",
  noKey: "WARNUNG: KI-Zeitung aus – AI_API_KEY fehlt",
};

export function describeConfig(): string[] {
  return [
    CONFIG.adminSecret ? "Admin-Passwort gesetzt" : "WARNUNG: ADMIN_SECRET fehlt – es können keine Spiele angelegt werden",
    CONFIG.ai.problem === null ? `KI-Zeitung aktiv (${CONFIG.ai.provider}, ${CONFIG.ai.model})` : AI_PROBLEM_LOG[CONFIG.ai.problem],
    "Push-Benachrichtigungen aktiv (Schlüssel werden beim ersten Start erzeugt)",
    `Auflösung ${CONFIG.resolveHour}:00, Erinnerung ${CONFIG.remindHour}:00 (${CONFIG.timeZone})`,
  ];
}
