// Anmeldung der Spielleitung: ein zufälliger Wert im Cookie, in der Datenbank nur sein Hash.
import { createHash, randomBytes } from "node:crypto";
import { CONFIG } from "../config.ts";
import { store } from "./store.ts";

export const ADMIN_SESSION_DAYS = 30;
const hash = (t: string) => createHash("sha256").update(t).digest("base64url");
// Fingerabdruck des Admin-Passworts: Wird ADMIN_SECRET geändert, gelten alte Anmeldungen nicht mehr.
const secretFp = () => hash("fvz-admin-secret:" + CONFIG.adminSecret);

export function startAdminSession(): string {
  const t = randomBytes(32).toString("base64url");
  store.addAdminSession(hash(t), Date.now() + ADMIN_SESSION_DAYS * 86_400_000, secretFp());
  return t;
}

export const isAdminSession = (t: string | undefined) => !!t && t.length < 200 && !!CONFIG.adminSecret && store.adminSessionValid(hash(t), secretFp());
export const endAdminSession = (t: string | undefined) => { if (t) store.deleteAdminSession(hash(t)); };
