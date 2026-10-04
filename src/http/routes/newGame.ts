// /api/new – neues Spiel anlegen. Nur mit Admin-Passwort; Fehlversuche werden begrenzt.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { adminUrl, checkAdminSecret, createGame } from "../../game/registration.ts";
import { clientAddress, failureLimiter } from "../rateLimit.ts";
import { HttpError, json, readBody } from "../respond.ts";

const secretAttempts = failureLimiter(5, 15 * 60_000); // 5 Fehlversuche pro 15 Minuten

export async function newGameRoute(req: IncomingMessage, res: ServerResponse) {
  const who = clientAddress(req);
  if (secretAttempts.blocked(who)) throw new HttpError(429, T.errors.tooManyAttempts);
  const b = await readBody(req);
  const check = checkAdminSecret(b.secret);
  if (check !== "ok") { secretAttempts.fail(who); throw new HttpError(403, T.errors[check]); }
  secretAttempts.reset(who);
  const { adminKey } = createGame({ names: Array.isArray(b.names) ? b.names.map(String) : [], bots: !!b.bots });
  json(res, { adminUrl: adminUrl(adminKey) });
}
