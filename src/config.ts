// Einstellungen und Zugangsdaten. Nur hier wird process.env gelesen. Vorlage: .env.example
// Leere Werte (z. B. "RESOLVE_HOUR=") gelten als nicht gesetzt, damit die Standardwerte greifen.
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
  mistral: { apiKey: env.MISTRAL_API_KEY ?? "", model: env.MISTRAL_MODEL ?? "mistral-small-latest" },
});

export function describeConfig(): string[] {
  return [
    CONFIG.adminSecret ? "Admin-Passwort gesetzt" : "WARNUNG: ADMIN_SECRET fehlt – es können keine Spiele angelegt werden",
    CONFIG.mistral.apiKey ? `KI-Zeitung aktiv (${CONFIG.mistral.model})` : "KI-Zeitung aus (kein MISTRAL_API_KEY) – schlichte Zusammenfassung",
    "Push-Benachrichtigungen aktiv (Schlüssel werden beim ersten Start erzeugt)",
    `Auflösung ${CONFIG.resolveHour}:00, Erinnerung ${CONFIG.remindHour}:00 (${CONFIG.timeZone})`,
  ];
}
