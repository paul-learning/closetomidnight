// /api/new – neues Spiel anlegen. Nur mit Admin-Passwort; Fehlversuche werden begrenzt.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { adminUrl, checkAdminSecret, createGame } from "../../game/registration.ts";
import { clientAddress, passwordAttempts } from "../rateLimit.ts";
import { HttpError, json, readBody } from "../respond.ts";

export async function newGameRoute(req: IncomingMessage, res: ServerResponse) {
  const who = clientAddress(req);
  if (passwordAttempts.blocked(who)) throw new HttpError(429, T.errors.tooManyAttempts);
  const b = await readBody(req);
  const check = checkAdminSecret(b.secret);
  if (check !== "ok") { passwordAttempts.fail(who); throw new HttpError(403, T.errors[check]); }
  passwordAttempts.reset(who);
  const { adminKey } = createGame({ names: Array.isArray(b.names) ? b.names.map(String) : [], bots: !!b.bots });
  json(res, { adminUrl: adminUrl(adminKey) });
}
