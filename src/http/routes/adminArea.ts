// /api/admin/… – Verwaltung aller Spiele. Nur mit Anmelde-Cookie der Spielleitung.
import type { IncomingMessage, ServerResponse } from "node:http";
import { T } from "../../i18n/index.ts";
import { endAdminSession, isAdminSession } from "../../game/adminSession.ts";
import { gameHistory } from "../../game/history.ts";
import { adminUrl, createGame } from "../../game/registration.ts";
import { CannotDelete, cancelGame, deleteGame } from "../../game/service.ts";
import { store } from "../../game/store.ts";
import { BALANCE } from "../../rules/balance.ts";
import { ADMIN_COOKIE, readCookie, setCookie } from "../cookies.ts";
import { HttpError, json, readBody, send } from "../respond.ts";

function gameList() {
  return store.allGames().map(g => ({
    id: g.id, created: g.created, day: g.state.day, days: BALANCE.days,
    status: g.cancelled ? "cancelled" : g.state.over ? "over" : "running",
    ending: g.state.ending ?? null, adminUrl: adminUrl(g.adminKey),
    players: store.players(g.id).map(p => ({ nation: g.state.players[p.idx].nation, name: p.name })),
  }));
}

export async function adminAreaRoute(req: IncomingMessage, res: ServerResponse, parts: string[]) {
  const session = readCookie(req, ADMIN_COOKIE);
  if (!isAdminSession(session)) throw new HttpError(401, T.errors.notLoggedIn);
  const [what, id, action] = parts;
  if (req.method === "POST" && what === "logout") {
    endAdminSession(session);
    setCookie(res, ADMIN_COOKIE, "", 0);
    return json(res, { ok: true });
  }
  if (what !== "games") throw new HttpError(404, T.errors.notFound);
  if (req.method === "POST" && !id) {
    const b = await readBody(req);
    createGame({ names: Array.isArray(b.names) ? b.names.map(String) : [], bots: !!b.bots });
    return json(res, { games: gameList() });
  }
  if (id) {
    const g = store.game(id); if (!g) throw new HttpError(404, T.errors.notFound);
    if (req.method === "GET" && action === "export") {
      const name = `fuenf-vor-zwoelf-${new Date(g.created || Date.now()).toISOString().slice(0, 10)}-${g.id}.md`;
      return send(res, 200, gameHistory(g), "text/markdown", { "Content-Disposition": `attachment; filename="${name}"` });
    }
    if (req.method === "POST" && action === "cancel") cancelGame(id);
    else if (req.method === "POST" && action === "delete") {
      try { deleteGame(id); } catch (e) { if (e instanceof CannotDelete) throw new HttpError(409, T.errors.cannotDelete); throw e; }
    } else throw new HttpError(404, T.errors.notFound);
  }
  json(res, { games: gameList() });
}
