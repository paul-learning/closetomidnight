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
