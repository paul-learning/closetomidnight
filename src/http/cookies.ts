// Cookie lesen und setzen. Nur für die Anmeldung der Spielleitung.
import type { IncomingMessage, ServerResponse } from "node:http";
import { CONFIG } from "../config.ts";

export const ADMIN_COOKIE = "fvz_admin";

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) { try { return decodeURIComponent(v.join("=")); } catch { return undefined; } }
  }
}

/** HttpOnly (kein Zugriff aus JavaScript), SameSite=Strict (nicht von fremden Seiten mitgeschickt), Secure bei https. */
export function setCookie(res: ServerResponse, name: string, value: string, maxAgeSeconds: number) {
  const secure = CONFIG.baseUrl.startsWith("https://") ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Strict${secure}`);
}
