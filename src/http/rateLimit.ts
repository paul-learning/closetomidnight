// Begrenzt Fehlversuche je Adresse (z. B. falsches Admin-Passwort). Nur im Speicher; ein Neustart setzt zurück.
import type { IncomingMessage } from "node:http";
import { CONFIG } from "../config.ts";

export function clientAddress(req: IncomingMessage): string {
  // Hinter Caddy steht die echte Adresse im Header; nur vertrauen, wenn ausdrücklich eingestellt.
  // Der letzte Eintrag stammt vom eigenen Proxy; frühere kann der Besucher selbst mitschicken.
  const forwarded = CONFIG.trustProxy ? String(req.headers["x-forwarded-for"] ?? "").split(",").at(-1)!.trim() : "";
  return forwarded || req.socket.remoteAddress || "unbekannt";
}

export function failureLimiter(maxFailures: number, windowMs: number) {
  const failures = new Map<string, number[]>();
  const recent = (key: string, now: number) => (failures.get(key) ?? []).filter(t => now - t < windowMs);
  return {
    /** true, wenn diese Adresse gerade gesperrt ist. */
    blocked(key: string): boolean { return recent(key, Date.now()).length >= maxFailures; },
    fail(key: string) {
      const now = Date.now(); failures.set(key, [...recent(key, now), now]);
      if (failures.size > 10_000) for (const [k] of failures) { if (!recent(k, now).length) failures.delete(k); }
    },
    reset(key: string) { failures.delete(key); },
    /**
     * Zählt einen Versuch schon vor der Prüfung (synchron, also ohne Lücke für gleichzeitige Anfragen).
     * false = gesperrt. Nach Erfolg reset() aufrufen.
     */
    tryAttempt(key: string): boolean { if (this.blocked(key)) return false; this.fail(key); return true; },
  };
}

/** Gemeinsam für alle Anmeldungen (Spieler und Spielleitung): 10 Fehlversuche je Adresse in 15 Minuten. */
export const passwordAttempts = failureLimiter(10, 15 * 60_000);
