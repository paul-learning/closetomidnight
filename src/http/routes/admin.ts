// /api/a/:adminKey – Seite eines Spiels für die Spielleitung: Ansicht, Auflösen, Einstellungen, Verbindungstests.
// Braucht die Anmeldung der Spielleitung (Cookie) UND den Schlüssel des Spiels: Ein Link allein reicht nicht.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { resetPassword } from "../../game/login.ts";
import { cancelGame, resolveGame, updateSettings } from "../../game/service.ts";
import { store } from "../../game/store.ts";
import { adminView } from "../../game/view.ts";
import { testAi } from "../../integrations/ai.ts";
import { requireAdmin } from "../adminAuth.ts";
import { HttpError, json, readBody } from "../respond.ts";

export async function adminRoute(req: IncomingMessage, res: ServerResponse, key: string, action?: string) {
  requireAdmin(req); // zuerst: ohne Anmeldung verrät die Antwort nicht, ob es den Schlüssel gibt
  const g = store.gameByAdminKey(key); if (!g) throw new HttpError(404, T.errors.badAdminLink);
  let newPassword: { idx: number; password: string } | undefined;
  if (req.method === "POST") {
    if (action === "resolve") await resolveGame(g.id);
    if (action === "settings") updateSettings(g.id, await readBody(req));
    if (action === "cancel") cancelGame(g.id);
    if (action === "test-ai") return json(res, { test: await testAi() });
    if (action === "password") {
      const idx = Number((await readBody(req)).idx), password = resetPassword(g.id, idx);
      if (password === null) throw new HttpError(400, T.errors.badRequest);
      newPassword = { idx, password };
    }
  }
  const fresh = store.game(g.id)!;
  json(res, { ...adminView(fresh.state, fresh, store.players(g.id), store.moves(g.id, fresh.state.day), store.papers(g.id)), cancelled: fresh.cancelled, newPassword });
}
