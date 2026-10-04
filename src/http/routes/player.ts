// /api/p/:token – Spieleransicht lesen, Zug speichern, Benachrichtigungen abonnieren.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { saveMove } from "../../game/service.ts";
import { store } from "../../game/store.ts";
import { playerView } from "../../game/view.ts";
import { subscribe } from "../../game/notifications.ts";
import { isPushEndpoint } from "../../integrations/push/send.ts";
import { HttpError, json, readBody } from "../respond.ts";

export async function playerRoute(req: IncomingMessage, res: ServerResponse, token: string, action?: string) {
  const pl = store.player(token); if (!pl) throw new HttpError(404, T.errors.badLink);
  if (req.method === "POST" && action === "push") {
    const b = await readBody(req);
    const ok = typeof b.endpoint === "string" && isPushEndpoint(b.endpoint) && typeof b.keys?.p256dh === "string" && typeof b.keys?.auth === "string";
    if (!ok) throw new HttpError(400, T.errors.badRequest);
    return json(res, { result: await subscribe(pl.gameId, pl.idx, { endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth }) });
  }
  if (req.method === "POST" && action === "move") {
    const body = await readBody(req);
    saveMove(store.game(pl.gameId)!, pl.idx, body.move, !!body.lock);
  }
  const game = store.game(pl.gameId)!;
  json(res, playerView(game.state, pl.idx, store.players(game.id), store.moves(game.id, game.state.day), store.papers(game.id)));
}
