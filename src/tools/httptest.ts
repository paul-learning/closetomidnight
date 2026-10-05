// Zugriffsregeln über echte HTTP-Anfragen gegen den Server: node --test src/tools/httptest.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = ":memory:";
process.env.PORT = "0";
process.env.ADMIN_SECRET = "test";
process.env.AI_PROVIDER = "";
process.env.MISTRAL_API_KEY = "";
const { startHttp } = await import("../http/server.ts");
const server = startHttp();
await once(server, "listening");
const B = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
test.after(() => server.close());

const post = (path: string, body: unknown, cookie = "", type = "application/json") =>
  fetch(B + path, { method: "POST", headers: { "Content-Type": type, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const get = (path: string, cookie = "") => fetch(B + path, { headers: cookie ? { Cookie: cookie } : {} });

async function adminCookie() {
  const res = await post("/api/login", { who: "admin", password: "test" });
  assert.equal(res.status, 200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

// Ein Spiel anlegen und Admin-Schlüssel sowie einen Spieler-Link holen
const cookie = await adminCookie();
const games = (await (await post("/api/admin/games", { names: ["A"] }, cookie)).json()).games;
const adminKey = new URL(games[0].adminUrl).pathname.split("/")[2];
const playerToken = new URL((await (await get(`/api/a/${adminKey}`, cookie)).json()).players[0].url).pathname.split("/")[2];

test("Seite eines Spiels (/api/a/…): nur mit Anmeldung der Spielleitung", async () => {
  assert.equal((await get(`/api/a/${adminKey}`)).status, 401, "Link allein reicht nicht");
  assert.equal((await post(`/api/a/${adminKey}/resolve`, {})).status, 401, "auch keine Aktionen ohne Anmeldung");
  assert.equal((await get(`/api/a/gibtsnicht`)).status, 401, "ohne Anmeldung verrät die Antwort nicht, ob es den Schlüssel gibt");
  assert.equal((await get(`/api/a/${adminKey}`, "fvz_admin=falsch")).status, 401);
  assert.equal((await get(`/api/a/${adminKey}`, cookie)).status, 200);
  assert.equal((await get(`/api/a/gibtsnicht`, cookie)).status, 404);
});

test("Änderungen der Spielleitung nur als JSON", async () => {
  assert.equal((await post(`/api/a/${adminKey}/settings`, { bots: true }, cookie, "text/plain")).status, 415);
  assert.equal((await post(`/api/a/${adminKey}/settings`, { bots: true }, cookie)).status, 200);
});

test("Verwaltung (/api/admin/…): nur mit Anmeldung", async () => {
  assert.equal((await get("/api/admin/games")).status, 401);
  assert.equal((await get("/api/admin/games", cookie)).status, 200);
});

test("Spieler-Links funktionieren weiter ohne Anmeldung", async () => {
  assert.equal((await get(`/api/p/${playerToken}`)).status, 200);
});

test("nach dem Abmelden gilt das Cookie auch für Spielseiten nicht mehr", async () => {
  const c = await adminCookie();
  assert.equal((await get(`/api/a/${adminKey}`, c)).status, 200);
  assert.equal((await post("/api/admin/logout", {}, c)).status, 200);
  assert.equal((await get(`/api/a/${adminKey}`, c)).status, 401);
});

test("Sicherheits-Kopfzeilen auf Seiten, Dateien, Bildern und API", async () => {
  for (const path of ["/", "/admin", "/js/main.js", "/strings.js", "/icons/icon-192.png", "/api/lobby", "/api/gibtsnicht"]) {
    const h = (await get(path)).headers;
    const csp = h.get("content-security-policy") ?? "";
    assert.match(csp, /script-src 'self'(;|$)/, `${path}: nur eigene Skripte`);
    assert.match(csp, /frame-ancestors 'none'/, `${path}: nicht einbettbar`);
    assert.ok(!/unsafe-inline|unsafe-eval/.test(csp), `${path}: keine Ausnahmen für Inline-Code`);
    assert.equal(h.get("referrer-policy"), "no-referrer", path);
    assert.equal(h.get("x-content-type-options"), "nosniff", path);
    assert.equal(h.get("x-frame-options"), "DENY", path);
    assert.ok(h.get("permissions-policy")?.includes("camera=()"), path);
    assert.equal(h.get("strict-transport-security"), null, `${path}: ohne HTTPS kein HSTS`);
  }
});
