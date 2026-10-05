// Anmeldung der Spielleitung: ein zufälliger Wert im Cookie, in der Datenbank nur sein Hash.
import { createHash, randomBytes } from "node:crypto";
import { store } from "./store.ts";

export const ADMIN_SESSION_DAYS = 30;
const hash = (t: string) => createHash("sha256").update(t).digest("base64url");

export function startAdminSession(): string {
  const t = randomBytes(32).toString("base64url");
  store.addAdminSession(hash(t), Date.now() + ADMIN_SESSION_DAYS * 86_400_000);
  return t;
}

export const isAdminSession = (t: string | undefined) => !!t && t.length < 200 && store.adminSessionValid(hash(t));
export const endAdminSession = (t: string | undefined) => { if (t) store.deleteAdminSession(hash(t)); };
