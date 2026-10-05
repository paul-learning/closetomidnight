// /api/lobby – wer spielt im aktuellen Spiel; /api/login – Anmeldung mit Passwort, Antwort ist der eigene Link.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { lobby, login } from "../../game/login.ts";
import { clientAddress, passwordAttempts } from "../rateLimit.ts";
import { HttpError, json, readBody } from "../respond.ts";

export function lobbyRoute(res: ServerResponse) {
  json(res, lobby());
}

export async function loginRoute(req: IncomingMessage, res: ServerResponse) {
  const who = clientAddress(req);
  if (passwordAttempts.blocked(who)) throw new HttpError(429, T.errors.tooManyAttempts);
  const b = await readBody(req);
  const r = login(b.who, b.password);
  if (!r.ok) {
    if (r.reason === "wrongPassword" || r.reason === "wrongSecret") passwordAttempts.fail(who);
    throw new HttpError(r.reason === "noGame" ? 404 : 403, T.errors[r.reason]);
  }
  passwordAttempts.reset(who);
  json(res, { url: r.url });
}
