// Zugang der Spielleitung: gültiges Anmelde-Cookie, und Änderungen nur als JSON.
// Gilt für die Verwaltung (/api/admin/…) und für die Seite eines einzelnen Spiels (/api/a/…).
import type { IncomingMessage } from "node:http";
import { T } from "../i18n/index.ts";
import { isAdminSession } from "../game/adminSession.ts";
import { ADMIN_COOKIE, readCookie } from "./cookies.ts";
import { HttpError } from "./respond.ts";

export function requireAdmin(req: IncomingMessage) {
  if (!isAdminSession(readCookie(req, ADMIN_COOKIE))) throw new HttpError(401, T.errors.notLoggedIn);
  // Zusätzlich zu SameSite=Strict: Änderungen nur als JSON (ein fremdes Formular kann das nicht schicken)
  if (req.method === "POST" && !String(req.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError(415, T.errors.badRequest);
}
