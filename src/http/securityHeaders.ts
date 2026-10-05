// Sicherheits-Kopfzeilen für jede Antwort: was der Browser mit unseren Seiten tun darf.
import { CONFIG } from "../config.ts";

/**
 * Content-Security-Policy: Skripte, Stile, Bilder usw. nur vom eigenen Server; Ausnahme sind die
 * Google-Schriften (Stylesheet von fonts.googleapis.com, Dateien von fonts.gstatic.com).
 * Kein Inline-JavaScript, keine Inline-Stile, nicht in fremde Seiten einbettbar.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY", // ältere Browser; neuere nutzen frame-ancestors
    // Spieler-Links enthalten das geheime Token: die Adresse nie an andere Seiten weitergeben
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    // Nur bei HTTPS: der Browser merkt sich, die Seite ein Jahr lang nur verschlüsselt zu öffnen
    ...(CONFIG.baseUrl.startsWith("https://") ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
  };
}
