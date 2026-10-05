// Schnelle Prüfungen: node --test src/tools/selftest.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { T } from "../i18n/index.ts";
import { CARD_POOL, CRISES, GOALS, OFFERS } from "../rules/content.ts";
import { NATIONS } from "../rules/types.ts";
import { NATION_RULES } from "../rules/nations.ts";
import { newGame, resolveDay } from "../engine/index.ts";
import { RuleError, validateMove } from "../engine/index.ts";
import { botMove } from "../bots/bots.ts";

test("jeder Spielinhalt hat einen Text", () => {
  for (const n of NATIONS) assert.ok(T.nations[n]?.name, `Nation ${n}`);
  for (const c of CRISES) {
    assert.ok(T.crises[c.id]?.name, `Krise ${c.id}`);
    for (const r of c.responses) assert.ok(T.crises[c.id].responses[r.id], `Option ${c.id}/${r.id}`);
  }
  for (const [c] of CARD_POOL) assert.ok(T.cards[c.id], `Karte ${c.id}`);
  for (const o of OFFERS) { assert.ok(T.offers[o.id], `Angebot ${o.id}`); assert.ok(T.powers[o.power]?.name, `Großmacht ${o.power}`); }
  for (const g of GOALS) assert.ok(T.goals[g.id], `Ziel ${g.id}`);
});

test("gleicher Seed, gleiches Spiel", () => {
  const play = () => { let s = newGame(42); while (!s.over) s = resolveDay(s, s.players.map((_, i) => botMove(s, i, "taktiker", () => 0.5))); return s; };
  assert.deepEqual(play(), play());
});

test("resolveDay verändert den alten Zustand nicht", () => {
  const s = newGame(7), copy = structuredClone(s);
  resolveDay(s, s.players.map(() => ({ vote: s.crisis.responses[0].id, cardId: null })));
  assert.deepEqual(s, copy);
});

test("Interaktionskarte ohne Ziel wird abgelehnt", () => {
  const s = newGame(1);
  s.players[0].hand = [{ id: "erpressung", kind: "interaktion", cost: 2, steal: 2 }];
  assert.throws(() => validateMove(s, 0, { cardId: "erpressung" }), (e: unknown) => e instanceof RuleError && e.code === "needTarget");
  assert.equal(validateMove(s, 0, { cardId: "erpressung", target: 2 }).target, 2);
});

test("unbekannte Eingaben werden verworfen", () => {
  const s = newGame(3);
  const m = validateMove(s, 1, { vote: "gibtsnicht", cardId: "gibtsnicht", veto: true, accuse: 1, acceptOffer: true });
  assert.equal(m.vote, null); assert.equal(m.cardId, null); assert.equal(m.accuse, undefined);
  assert.equal(m.veto, NATION_RULES[s.players[1].nation].veto ? true : undefined);
});

test("Bericht nennt ein Ziel nur bei Interaktionskarten", () => {
  const s = newGame(5);
  s.players[0].hand = [{ id: "gipfel", kind: "sauber", cost: 0, vp: 2, tracks: { krieg: -2 } }];
  const next = resolveDay(s, s.players.map((_, i) => i === 0 ? { vote: null, cardId: "gipfel", target: 2 } : { vote: null, cardId: null }));
  assert.equal(next.history[0].cards[0].target, undefined);
});

test("Karte scheitert nicht an den Kosten des Ratsbeschlusses", () => {
  const s = newGame(9);
  s.players.forEach(p => { p.pk = 3; });
  s.players[0].hand = [{ id: "gipfel", kind: "sauber", cost: 3, vp: 2, tracks: { krieg: -2 } }];
  const strong = s.crisis.responses[0].id; // alle stimmen für die teuerste Option
  const next = resolveDay(s, s.players.map((_, i) => ({ vote: strong, cardId: i === 0 ? "gipfel" : null })));
  assert.equal(next.history[0].passed, strong);
  assert.ok(next.history[0].cards.some(c => c.card === "gipfel"));
});

test("Diebstahl verhindert keine fremde Karte", () => {
  const s = newGame(11);
  s.players.forEach(p => { p.pk = 2; });
  s.players[0].hand = [{ id: "erpressung", kind: "interaktion", cost: 0, steal: 2 }];
  s.players[1].hand = [{ id: "faktencheck", kind: "sauber", cost: 2, vp: 1, tracks: { kollaps: -1 } }];
  const next = resolveDay(s, s.players.map((_, i) => i === 0 ? { vote: null, cardId: "erpressung", target: 1 }
    : i === 1 ? { vote: null, cardId: "faktencheck" } : { vote: null, cardId: null }));
  assert.deepEqual(next.history[0].cards.map(c => c.card), ["erpressung", "faktencheck"]);
});

test("zu teure Karte wird beim Speichern abgelehnt", () => {
  const s = newGame(13);
  s.players[0].pk = 1;
  s.players[0].hand = [{ id: "gipfel", kind: "sauber", cost: 3, vp: 2, tracks: { krieg: -2 } }];
  assert.throws(() => validateMove(s, 0, { cardId: "gipfel" }), (e: unknown) => e instanceof RuleError && e.code === "tooExpensive");
});

test("Passwörter: Hash prüft richtig, Schreibweise egal, kein Klartext gespeichert", async () => {
  const { generatePassword, hashPassword, verifyPassword } = await import("../game/passwords.ts");
  const pw = generatePassword();
  assert.match(pw, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  assert.notEqual(generatePassword(), pw);
  const h = hashPassword(pw);
  assert.ok(!h.includes(pw.replace(/-/g, "")));
  assert.ok(verifyPassword(pw, h));
  assert.ok(verifyPassword(` ${pw.toUpperCase().replace(/-/g, "")} `, h));
  assert.ok(!verifyPassword(pw.slice(0, -1) + (pw.endsWith("a") ? "b" : "a"), h));
  assert.ok(!verifyPassword(pw, null));
  assert.ok(!verifyPassword(123, h));
  assert.ok(!verifyPassword(pw, "kaputt"));
  assert.notEqual(hashPassword(pw), h, "jeder Hash hat ein eigenes Salz");
});
