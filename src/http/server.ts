// HTTP: Routing und Fehlerübersetzung. Die Routen selbst stehen in routes/.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { CONFIG } from "../config.ts";
import { RuleError } from "../engine/index.ts";
import { T } from "../i18n/index.ts";
import { GameCancelled } from "../game/service.ts";
import { HttpError, json } from "./respond.ts";
import { serveStatic, serveStrings } from "./static.ts";
import { adminRoute } from "./routes/admin.ts";
import { lobbyRoute, loginRoute } from "./routes/login.ts";
import { adminAreaRoute } from "./routes/adminArea.ts";
import { playerRoute } from "./routes/player.ts";

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", CONFIG.baseUrl);
  const [first, second, third, fourth] = url.pathname.split("/").filter(Boolean);
  if (req.method === "GET") {
    if (!first || first === "p" || first === "a" || (first === "admin" && !second)) return serveStatic(res, "index.html");
    if (first === "strings.js") return serveStrings(res);
    if (first === "css" || first === "js" || first === "icons") return serveStatic(res, url.pathname);
    if (first === "sw.js" || first === "manifest.webmanifest") return serveStatic(res, first);
  }
  if (first === "api") {
    if (second === "admin") return adminAreaRoute(req, res, url.pathname.split("/").filter(Boolean).slice(2));
    if (second === "lobby" && req.method === "GET") return lobbyRoute(res);
    if (second === "login" && req.method === "POST") return loginRoute(req, res);
    if (second === "p" && third) return playerRoute(req, res, third, fourth);
    if (second === "a" && third) return adminRoute(req, res, third, fourth);
  }
  throw new HttpError(404, T.errors.notFound);
}

export function startHttp() {
  createServer(async (req, res) => {
    try { await route(req, res); }
    catch (e) {
      if (e instanceof RuleError) return json(res, { error: T.errors[e.code] }, 400);
      if (e instanceof GameCancelled) return json(res, { error: T.errors.cancelled }, 409);
      if (e instanceof HttpError) return json(res, { error: e.message }, e.status);
      console.error(e);
      json(res, { error: T.errors.badRequest }, 500);
    }
  }).listen(CONFIG.port, () => console.log(`Fünf vor Zwölf läuft auf ${CONFIG.baseUrl}`));
}
