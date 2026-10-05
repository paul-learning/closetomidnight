// Spielbetrieb mit echter (In-Memory-)Datenbank: node --test src/tools/gametest.ts
// Umgebung vor dem Laden setzen, deshalb dynamische Importe.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DB_PATH = ":memory:";
process.env.ADMIN_SECRET = "test";
process.env.MISTRAL_API_KEY = "";
const { store } = await import("../game/store.ts");
const { createGame } = await import("../game/registration.ts");
const { cancelGame, resolveGame, saveMove, GameCancelled } = await import("../game/service.ts");
const { lobby, login } = await import("../game/login.ts");

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
  assert.deepEqual(await login("admin", "test"), { ok: false, reason: "noGame" });
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
