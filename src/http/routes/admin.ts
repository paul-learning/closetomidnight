// /api/a/:adminKey – Spielleitung: Ansicht, Auflösen, Einstellungen, Verbindungstests.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { resolveGame, updateSettings } from "../../game/service.ts";
import { store } from "../../game/store.ts";
import { adminView } from "../../game/view.ts";
import { testAi } from "../../integrations/mistral.ts";
import { HttpError, json, readBody } from "../respond.ts";

export async function adminRoute(req: IncomingMessage, res: ServerResponse, key: string, action?: string) {
  const g = store.gameByAdminKey(key); if (!g) throw new HttpError(404, T.errors.badAdminLink);
  if (req.method === "POST") {
    if (action === "resolve") await resolveGame(g.id);
    if (action === "settings") updateSettings(g.id, await readBody(req));
    if (action === "test-ai") return json(res, { test: await testAi() });
  }
  const fresh = store.game(g.id)!;
  json(res, adminView(fresh.state, fresh, store.players(g.id), store.moves(g.id, fresh.state.day), store.papers(g.id)));
}
