// /api/lobby – wer spielt im aktuellen Spiel; /api/login – Anmeldung.
// Spieler: Antwort ist der eigene Link. Spielleitung: Cookie für die Verwaltung (/admin), unabhängig vom Spiel.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { lobby, login } from "../../game/login.ts";
import { checkAdminSecret } from "../../game/registration.ts";
import { ADMIN_SESSION_DAYS, startAdminSession } from "../../game/adminSession.ts";
import { ADMIN_COOKIE, setCookie } from "../cookies.ts";
import { clientAddress, passwordAttempts } from "../rateLimit.ts";
import { HttpError, json, readBody } from "../respond.ts";

export function lobbyRoute(res: ServerResponse) {
  json(res, lobby());
}

export async function loginRoute(req: IncomingMessage, res: ServerResponse) {
  const who = clientAddress(req);
  const b = await readBody(req);
  // Erst zählen, dann prüfen: So kommen auch gleichzeitige Anfragen nicht über die Grenze.
  if (!passwordAttempts.tryAttempt(who)) throw new HttpError(429, T.errors.tooManyAttempts);
  if (b.who === "admin") {
    const check = checkAdminSecret(b.password);
    if (check !== "ok") throw new HttpError(403, T.errors[check]);
    passwordAttempts.reset(who);
    setCookie(res, ADMIN_COOKIE, startAdminSession(), ADMIN_SESSION_DAYS * 86_400);
    return json(res, { url: "/admin" });
  }
  const r = await login(b.who, b.password);
  if (!r.ok) throw new HttpError(r.reason === "noGame" ? 404 : 403, T.errors[r.reason]);
  passwordAttempts.reset(who);
  json(res, { url: r.url });
}
