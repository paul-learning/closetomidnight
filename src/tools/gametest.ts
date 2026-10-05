// Spielbetrieb mit echter (In-Memory-)Datenbank: node --test src/tools/gametest.ts
// Umgebung vor dem Laden setzen, deshalb dynamische Importe.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.ADMIN_SECRET = "test";
process.env.MISTRAL_API_KEY = "";
process.env.AI_PROVIDER = "";
const { store } = await import("../game/store.ts");
const { createGame } = await import("../game/registration.ts");
const { cancelGame, resolveGame, saveMove, GameCancelled } = await import("../game/service.ts");
const { lobby, login } = await import("../game/login.ts");
const { gameHistory } = await import("../game/history.ts");
const { deleteGame, CannotDelete } = await import("../game/service.ts");
const { startAdminSession, isAdminSession, endAdminSession } = await import("../game/adminSession.ts");

const newGame = () => {
  const { adminKey } = createGame({ names: ["A", "B", "C", "D"], bots: false });
  return store.gameByAdminKey(adminKey)!;
};

test("ein neues Spiel bricht das laufende ab", () => {
  const a = newGame(), b = newGame();
  assert.equal(store.game(a.id)!.cancelled, true);
  assert.equal(store.game(b.id)!.cancelled, false);
  assert.deepEqual(store.activeGames().map(g => g.id), [b.id]);
});

test("abgebrochenes Spiel: keine Auflösung, keine Züge, Startseite leer", async () => {
  const g = newGame();
  cancelGame(g.id);
  await resolveGame(g.id);
  assert.equal(store.game(g.id)!.state.day, 1);
  assert.throws(() => saveMove(store.game(g.id)!, 0, { vote: null, cardId: null }, true), GameCancelled);
  assert.deepEqual(lobby(), { game: null });
  assert.deepEqual(await login(0, "egal"), { ok: false, reason: "noGame" });
  assert.deepEqual(store.activeGames(), []);
});

test("Abbruch während die Zeitung entsteht: nichts wird gespeichert", async () => {
  const g = newGame();
  const running = resolveGame(g.id); // läuft bis zum Schreiben der Zeitung
  cancelGame(g.id);
  await running;
  assert.equal(store.game(g.id)!.state.day, 1);
  assert.deepEqual(store.papers(g.id), []);
});

test("ein beendetes Spiel lässt sich nicht abbrechen", () => {
  const g = newGame();
  store.saveState(g.id, { ...g.state, over: true }, "2026-01-01");
  cancelGame(g.id);
  assert.equal(store.game(g.id)!.cancelled, false);
});

test("laufendes Spiel wird normal aufgelöst", async () => {
  const g = newGame();
  await resolveGame(g.id);
  assert.equal(store.game(g.id)!.state.day, 2);
  assert.equal(store.papers(g.id).length, 1);
});

test("Verlauf enthält geheime Züge, Zeitung und Ergebnis", async () => {
  const g = newGame();
  store.saveMove(g.id, 1, 0, { vote: g.state.crisis.responses[0].id, cardId: null, acceptOffer: true }, true);
  await resolveGame(g.id);
  const text = gameHistory(store.game(g.id)!);
  assert.match(text, /^# Fünf vor Zwölf – Spielverlauf/);
  assert.match(text, /\*\*Teutonien:\*\* A/);                       // Spielername
  assert.match(text, /## Tag 1: /);
  assert.match(text, /nimmt das Angebot am roten Telefon an/);        // geheimer Zug
  assert.match(text, /\*\*Zeitung:\*\*/);
  assert.match(text, /kein gespeicherter Zug \(Enthaltung oder Bot\)/);
});

test("Startseite: nach dem Löschen des aktuellen Spiels kommt kein älteres zurück", async () => {
  const a = newGame();
  store.saveState(a.id, { ...a.state, over: true }, "2026-01-01");
  const b = newGame();
  assert.equal(lobby().game?.id, b.id);
  cancelGame(b.id); deleteGame(b.id);
  assert.deepEqual(lobby(), { game: null });
  assert.equal((await login(0, "egal")).ok, false);
});

test("Abbruch und Löschen während die Zeitung entsteht: keine verwaiste Zeitung", async () => {
  const g = newGame();
  const running = resolveGame(g.id);
  cancelGame(g.id); deleteGame(g.id);
  await running;
  assert.deepEqual(store.papers(g.id), []);
});

test("löschen: nur beendete oder abgebrochene Spiele, dann ist alles weg", async () => {
  const g = newGame();
  assert.throws(() => deleteGame(g.id), CannotDelete);
  store.saveMove(g.id, 1, 0, { vote: null, cardId: null }, true);
  cancelGame(g.id);
  deleteGame(g.id);
  assert.equal(store.game(g.id), undefined);
  assert.deepEqual(store.players(g.id), []);
  assert.deepEqual(store.allMoves(g.id), []);
});

test("Anmeldung der Spielleitung: gültig, bis sie beendet wird", () => {
  const t = startAdminSession();
  assert.ok(isAdminSession(t));
  assert.ok(!isAdminSession(t + "x"));
  assert.ok(!isAdminSession(undefined));
  endAdminSession(t);
  assert.ok(!isAdminSession(t));
});

test("Anmeldung der Spielleitung: neues Admin-Passwort macht alte Anmeldungen ungültig", async () => {
  const { CONFIG } = await import("../config.ts");
  const t = startAdminSession();
  const old = CONFIG.adminSecret;
  // CONFIG ist eingefroren; den Fingerabdruck prüfen wir direkt an der Datenbank
  const { createHash } = await import("node:crypto");
  const h = (x: string) => createHash("sha256").update(x).digest("base64url");
  assert.ok(store.adminSessionValid(h(t), h("fvz-admin-secret:" + old)));
  assert.ok(!store.adminSessionValid(h(t), h("fvz-admin-secret:anderes")));
});
