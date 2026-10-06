// Schnelle Prüfungen: node --test src/tools/selftest.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { T } from "../i18n/index.ts";
import { CARDS, CRISES, GOALS, OFFERS, cardTier } from "../rules/content.ts";
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
  for (const c of CARDS) assert.ok(T.cards[c.id], `Karte ${c.id}`);
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
  assert.ok(await verifyPassword(pw, h));
  assert.ok(await verifyPassword(` ${pw.toUpperCase().replace(/-/g, "")} `, h));
  assert.ok(!await verifyPassword(pw.slice(0, -1) + (pw.endsWith("a") ? "b" : "a"), h));
  assert.ok(!await verifyPassword(pw, null));
  assert.ok(!await verifyPassword(123, h));
  assert.ok(!await verifyPassword(pw, "kaputt"));
  assert.notEqual(hashPassword(pw), h, "jeder Hash hat ein eigenes Salz");
});

test("Fehlversuche: auch gleichzeitige Anfragen kommen nicht über die Grenze", async () => {
  const { failureLimiter } = await import("../http/rateLimit.ts");
  const lim = failureLimiter(10, 60_000);
  const allowed = (await Promise.all(Array.from({ length: 50 }, async () => { await null; return lim.tryAttempt("1.2.3.4"); }))).filter(Boolean).length;
  assert.equal(allowed, 10);
  lim.reset("1.2.3.4");
  assert.ok(lim.tryAttempt("1.2.3.4"));
});

test("Zeitungstext: Markdown wird zu reinem Text", async () => {
  const { toPlainText } = await import("../newspaper/plainText.ts");
  assert.equal(toPlainText("**PANIK IN DER WISSENSCHAFT: UHR ERREICHT ZWÖLF!**"), "PANIK IN DER WISSENSCHAFT: UHR ERREICHT ZWÖLF!");
  assert.equal(toPlainText("## Schlagzeile\n\n- Teutonien *stimmt* für __Krieg__\n* Gallien spielt `Notstand`\n\n\n> „Zitat“ – Trampel\n---\nDie Uhr steht auf 23:40"),
    "Schlagzeile\n\n• Teutonien stimmt für Krieg\n• Gallien spielt Notstand\n\n„Zitat“ – Trampel\n\nDie Uhr steht auf 23:40");
  assert.equal(toPlainText("Mehr unter [Kurier](https://example.org)."), "Mehr unter Kurier.");
  // aus dem Review: Trennlinien mit Abständen, schließende #, Unterstreichung, eingerückte Punkte
  assert.equal(toPlainText("Oben\n* * *\n- - -\nUnten"), "Oben\n\n\nUnten".replace(/\n{3,}/g, "\n\n"));
  assert.equal(toPlainText("## Schlagzeile ##"), "Schlagzeile");
  assert.equal(toPlainText("Schlagzeile\n=========\nText"), "Schlagzeile\n\nText");
  assert.equal(toPlainText("- Punkt\n    - Unterpunkt"), "• Punkt\n• Unterpunkt");
  // Normaler Text bleibt, wie er ist: Sternchen in Wörtern, Mathe, einzelne Zeichen, Emojis
  for (const s of ["🗞 Tag 3: Krieg 4 × 2", "Preis 5 * 3 = 15", "• schon ein Punkt", "Rüstung_2026 bleibt", "Sterne * hier"]) assert.equal(toPlainText(s), s);
});

test("Kasten „gegen dich“: Diebstahl mit tatsächlichem Betrag, Leak, Anklage – nur für das Ziel", async () => {
  const { incomingFor } = await import("../game/view.ts");
  const s = newGame(11);
  // Spieler 0 erpresst Spieler 1 (der nur 1 Einfluss hat), Spieler 2 leakt Spieler 1
  s.players[0].hand = [{ id: "erpressung", kind: "interaktion", cost: 0, steal: 2 }];
  s.players[2].hand = [{ id: "leak", kind: "interaktion", cost: 0, leak: true }];
  s.players[1].pk = 1;
  const none = { vote: null, cardId: null };
  const next = resolveDay(s, [{ ...none, cardId: "erpressung", target: 1 }, none, { ...none, cardId: "leak", target: 1 }, none]);
  const inc = incomingFor(next, 1)!;
  assert.equal(inc.day, 1);
  assert.deepEqual(inc.cards.map(c => [c.nation, c.card, c.stolen]), [[next.players[0].nation, "erpressung", 1], [next.players[2].nation, "leak", null]]);
  assert.equal(inc.accused, null);
  assert.equal(incomingFor(next, 3), null, "wer nichts abbekommen hat, sieht keinen Kasten");
  assert.equal(incomingFor(newGame(1), 0), null, "vor dem ersten aufgelösten Tag: nichts");
});

test("Kasten „gegen dich“: Anklage zeigt nur richtig/falsch, nie die Ankläger", async () => {
  const { incomingFor } = await import("../game/view.ts");
  const none = { vote: null, cardId: null };
  const s = newGame(5);
  const next = resolveDay(s, [none, { ...none, accuse: 0 }, { ...none, accuse: 0 }, none]); // Spieler 0 ist kein Überläufer
  assert.deepEqual(incomingFor(next, 0), { day: 1, cards: [], accused: { correct: false }, councilDebt: null });
  for (const i of [1, 2, 3]) assert.equal(incomingFor(next, i), null, "Ankläger und Unbeteiligte sehen keinen Kasten");
});

test("Sanktionen: braucht ein Ziel, kostet 1 Einfluss, Ziel verliert 1 Siegpunkt, erscheint im Kasten", async () => {
  const { incomingFor } = await import("../game/view.ts");
  const s = newGame(21);
  s.players[0].hand = [{ id: "sanktionen", kind: "interaktion", cost: 1, sanction: 1 }];
  assert.throws(() => validateMove(s, 0, { vote: null, cardId: "sanktionen" }), RuleError, "ohne Ziel abgelehnt");
  const none = { vote: null, cardId: null };
  const before = { pk0: s.players[0].pk, vp2: s.players[2].vp };
  const next = resolveDay(s, [{ ...none, cardId: "sanktionen", target: 2 }, none, none, none]);
  assert.equal(next.players[2].vp, before.vp2 - 1);
  assert.ok(next.players[0].pk <= before.pk0 - 1 + 3, "Kosten bezahlt (plus Tageseinkommen)");
  assert.deepEqual(incomingFor(next, 2)!.cards, [{ nation: next.players[0].nation, card: "sanktionen", fizzled: false, stolen: null, vpLost: 1, leaked: null, blockedMine: null }]);
});

test("Leak: Spieler, deren Ziele man schon alle kennt, sind kein Ziel mehr (Regel, Seite, Bots)", async () => {
  const { playerView } = await import("../game/view.ts");
  const s = newGame(22);
  const leak = { id: "leak", kind: "interaktion", cost: 2, leak: true } as const;
  s.players[0].hand = [{ ...leak }];
  s.players[0].intel = s.players[1].goals.map(goal => ({ nation: s.players[1].nation, goal }));
  assert.throws(() => validateMove(s, 0, { vote: null, cardId: "leak", target: 1 }), (e: any) => e instanceof RuleError && e.code === "leakKnown");
  assert.doesNotThrow(() => validateMove(s, 0, { vote: null, cardId: "leak", target: 2 }), "andere Ziele bleiben wählbar");
  const rows = s.players.map((_, j) => ({ name: `P${j}` })) as any;
  const view = playerView(s, 0, rows, [null, null, null, null], []);
  assert.deepEqual(view.players.map(p => p.allGoalsKnown), [false, true, false, false]);
  // Bots: nie gegen ein bekanntes Ziel; sind alle bekannt, wird die Karte nicht gespielt
  for (const t of [2, 3]) s.players[0].intel.push(...s.players[t].goals.map(goal => ({ nation: s.players[t].nation, goal })));
  for (let k = 0; k < 50; k++) {
    const m = botMove(s, 0, "taktiker", () => k / 50);
    assert.notEqual(m.cardId, "leak");
  }
});

test("Leak: das aufgedeckte Ziel steht am nächsten Tag im Kasten, danach nur noch in der Akte", async () => {
  const { playerView } = await import("../game/view.ts");
  const rows = [0, 1, 2, 3].map(j => ({ name: `P${j}` })) as any, view = (s: any, i: number) => playerView(s, i, rows, [null, null, null, null], []);
  const s = newGame(23);
  s.players[0].hand = [{ id: "leak", kind: "interaktion", cost: 2, leak: true }];
  s.players[0].intel.push({ nation: s.players[3].nation, goal: "altes-ziel" }); // alter Spielstand ohne Tag
  const none = { vote: null, cardId: null };
  const next = resolveDay(s, [{ ...none, cardId: "leak", target: 1 }, none, none, none]);
  const learned = next.players[0].intel.at(-1)!;
  assert.equal(learned.nation, next.players[1].nation);
  assert.equal(learned.day, s.day);
  const goal = GOALS.find(g => g.id === learned.goal)!;
  assert.deepEqual(view(next, 0).me.intelNew, [{ id: goal.id, kind: goal.kind, vp: goal.vp, nation: learned.nation, day: s.day }]);
  assert.deepEqual(view(next, 1).me.intelNew, [], "nur der Spieler, der geleakt hat");
  const later = resolveDay(next, [none, none, none, none]);
  assert.ok(!later.over, "Testaufbau: Spiel läuft noch");
  assert.deepEqual(view(later, 0).me.intelNew, [], "am Tag danach nicht mehr");
  assert.equal(view(later, 0).me.intel.length, 2, "in der Akte bleibt alles");
});

test("Kartenstapel: jede Karte einmal, 50/30/20 nach Klassen, Interaktion häufig genug", () => {
  assert.equal(new Set(CARDS.map(c => c.id)).size, CARDS.length, "keine Doppelungen");
  const tiers = [0, 1, 2].map(k => CARDS.filter(c => cardTier(c) === k).length / CARDS.length);
  assert.deepEqual(tiers, [0.5, 0.3, 0.2]);
  for (const c of CARDS) assert.ok(c.cost <= 3 || (c.cost >= 5 && c.cost <= 8), `${c.id}: Preis passt in eine Klasse`);
  const total = CARDS.length, inter = CARDS.filter(c => c.kind === "interaktion").length;
  // Wahrscheinlichkeit, ohne Interaktionskarte in den drei Startkarten zu sein
  const none = ((total - inter) / total) * ((total - inter - 1) / (total - 1)) * ((total - inter - 2) / (total - 2));
  assert.ok(none < 0.35, `${Math.round(none * 100)} % ohne Interaktionskarte`);
  assert.equal(newGame(1).deck.length + 12, total, "alle Karten im Spiel");
});

test("Cyberangriff: die Karte des Ziels verpufft (bezahlt), steht im Bericht und im Kasten", async () => {
  const { incomingFor } = await import("../game/view.ts");
  const s = newGame(31);
  s.players[0].hand = [{ id: "cyberangriff", kind: "interaktion", cost: 5, block: true }];
  s.players[1].hand = [{ id: "waffendeal", kind: "schmutzig", cost: 1, vp: 3, tracks: { krieg: 1 } }];
  s.players[0].pk = 5;
  const none = { vote: null, cardId: null };
  const next = resolveDay(s, [{ ...none, cardId: "cyberangriff", target: 1 }, { ...none, cardId: "waffendeal" }, none, none]);
  assert.equal(next.players[1].vp, s.players[1].vp, "keine Siegpunkte");
  assert.equal(next.tracks.krieg >= s.tracks.krieg, true);
  assert.equal(next.players[1].hand.some(c => c.id === "waffendeal"), false, "Karte ist weg");
  assert.deepEqual(next.history.at(-1)!.cards.find(c => c.card === "waffendeal"), { nation: next.players[1].nation, card: "waffendeal", target: undefined, blocked: true });
  assert.equal(incomingFor(next, 1)!.cards[0].blockedMine, true);
  // Gegenseitig: beide verpuffen
  const t = newGame(32);
  for (const k of [0, 1]) { t.players[k].hand = [{ id: "cyberangriff", kind: "interaktion", cost: 5, block: true }]; t.players[k].pk = 5; }
  const both = resolveDay(t, [{ ...none, cardId: "cyberangriff", target: 1 }, { ...none, cardId: "cyberangriff", target: 0 }, none, none]);
  assert.deepEqual(both.history.at(-1)!.cards.map(c => c.blocked), [true, true]);
  assert.equal(incomingFor(both, 1)!.cards[0].fizzled, true);
});

test("Doppelagent deckt beide Ziele auf, Grundeinkommen gibt allen Einfluss", () => {
  const s = newGame(33);
  s.players[0].hand = [{ id: "doppelagent", kind: "interaktion", cost: 6, leak: 2 }];
  s.players[2].hand = [{ id: "grundeinkommen", kind: "sauber", cost: 7, vp: 2, everyonePk: 3, tracks: { kollaps: -2 } }];
  s.players[0].pk = 6; s.players[2].pk = 7;
  const none = { vote: null, cardId: null };
  const next = resolveDay(s, [{ ...none, cardId: "doppelagent", target: 1 }, none, { ...none, cardId: "grundeinkommen" }, none]);
  assert.deepEqual(next.players[0].intel.map(x => x.goal).sort(), [...s.players[1].goals].sort());
  // Einkommen 3 pro Tag plus 3 aus dem Grundeinkommen
  assert.equal(next.players[3].pk, s.players[3].pk + 3 + 3);
  assert.equal(next.players[0].pk, 0 + 3 + 3);
});


test("Überweisung: sofort, nur freier Einfluss, Betreff bereinigt, Tagessumme öffentlich", async () => {
  const { transfer, freePk } = await import("../engine/index.ts");
  const s = newGame(41);
  s.players[0].pk = 10;
  const card = { id: "gipfel", kind: "sauber" as const, cost: 3, vp: 2, tracks: { krieg: -2 } };
  s.players[0].hand = [card];
  const vote = s.crisis.responses.find(r => r.costEach > 0)!;
  const move = { vote: vote.id, cardId: "gipfel" };
  assert.equal(freePk(s, 0, move), 10 - 3 - vote.costEach);
  assert.throws(() => transfer(s, 0, { to: 1, amount: freePk(s, 0, move) + 1 }, move), (e: any) => e.code === "notEnoughFree");
  for (const bad of [{ to: 0, amount: 1 }, { to: 4, amount: 1 }, { to: 1, amount: 0 }, { to: 1, amount: 1.5 }, { to: "1", amount: 1 }])
    assert.throws(() => transfer(s, 0, bad, move), (e: any) => e.code === "badTransfer", JSON.stringify(bad));
  const after = transfer(s, 0, { to: 2, amount: 2, subject: "  für\\n deine\u0007 Stimme  " + "x".repeat(80) }, move);
  assert.equal(after.players[0].pk, 8);
  assert.equal(after.players[2].pk, s.players[2].pk + 2);
  assert.equal(s.players[0].pk, 10, "alter Zustand unverändert");
  const t = after.transfers![0];
  assert.equal(t.day, 1); assert.equal(t.subject.length, 60); assert.ok(!/[\u0000-\u001f]/.test(t.subject));
  // Ohne gespeicherten Zug ist alles frei
  assert.equal(freePk(s, 0, null), 10);
  const two = transfer(after, 1, { to: 0, amount: 1 }, null);
  const none = { vote: null, cardId: null };
  const next = resolveDay(two, [none, none, none, none]);
  assert.equal(next.history.at(-1)!.transferred, 3);
  assert.equal(resolveDay(next, [none, none, none, none]).history.at(-1)!.transferred ?? 0, 0, "am nächsten Tag zählt nur der neue Tag");
  // Logbuch in der Spieleransicht: nur eigene Überweisungen
  const { playerView } = await import("../game/view.ts");
  const rows = [0, 1, 2, 3].map(j => ({ name: `P${j}` })) as any, view = (i: number) => playerView(two, i, rows, [null, null, null, null], []);
  assert.deepEqual(view(0).transfers.map(x => [x.out, x.nation, x.amount]), [[false, two.players[1].nation, 1], [true, two.players[2].nation, 2]]);
  assert.deepEqual(view(3).transfers, []);
});

test("Überweisung bleibt geheim: andere sehen den Einfluss vom Tagesbeginn; Spam-Grenze; Betreff ohne Richtungszeichen", async () => {
  const { transfer, cleanSubject, TRANSFERS_PER_DAY } = await import("../engine/index.ts");
  const { playerView } = await import("../game/view.ts");
  const s = newGame(42);
  const t = transfer(s, 0, { to: 1, amount: 2 }, null);
  const rows = [0, 1, 2, 3].map(j => ({ name: `P${j}` })) as any, view = (i: number) => playerView(t, i, rows, [null, null, null, null], []);
  assert.deepEqual(view(2).players.map(p => p.pk), s.players.map(p => p.pk), "Dritte sehen nichts");
  assert.equal(view(0).players[0].pk, s.players[0].pk - 2, "eigener Einfluss echt");
  assert.equal(view(0).players[1].pk, s.players[1].pk, "auch Absender sieht den Empfänger ohne Überweisung");
  assert.equal(view(1).me.pk, s.players[1].pk + 2);
  let u = structuredClone(s); u.players[0].pk = 100;
  for (let k = 0; k < TRANSFERS_PER_DAY; k++) u = transfer(u, 0, { to: 1, amount: 1 }, null);
  assert.throws(() => transfer(u, 0, { to: 2, amount: 1 }, null), (e: any) => e.code === "tooManyTransfers");
  assert.doesNotThrow(() => transfer(u, 1, { to: 0, amount: 1 }, null), "Grenze gilt je Absender");
  assert.equal(cleanSubject("a‮b​c⁦d"), "a b c d");
});

test("Ratskosten nicht bezahlbar: Siegpunkte weg, nur der Betroffene erfährt es; Rest nach der Karte für die Warnung", async () => {
  const { pkAfterCard } = await import("../engine/index.ts");
  const { incomingFor, playerView } = await import("../game/view.ts");
  const s = newGame(43);
  const opt = s.crisis.responses.filter(r => !r.unanimous && r.costEach > 0)[0] ?? s.crisis.responses.find(r => r.costEach > 0)!;
  s.players[0].pk = 0; s.players[0].vp = 5;
  s.players[0].hand = [{ id: "notstand", kind: "schmutzig", cost: 0, vp: 2, pk: 2, tracks: { autokratie: 1 } }];
  assert.equal(pkAfterCard(s, 0, { vote: null, cardId: "notstand" }), 0, "Einfluss-Gewinn der Karte zählt nicht (Blockade möglich)");
  const votes = s.players.map(() => ({ vote: opt.id, cardId: null }));
  const next = resolveDay(s, votes);
  assert.equal(next.history.at(-1)!.passed, opt.id);
  assert.deepEqual(next.players[0].councilDebt, { day: 1, vp: opt.costEach });
  assert.equal(next.players[0].vp, 5 - opt.costEach);
  assert.equal(incomingFor(next, 0)!.councilDebt, opt.costEach);
  assert.equal(incomingFor(next, 1)?.councilDebt ?? null, null);
  assert.ok(!JSON.stringify(next.history.at(-1)).includes("Debt"), "nicht im öffentlichen Bericht");
  const rows = [0, 1, 2, 3].map(j => ({ name: `P${j}` })) as any;
  assert.ok(!("councilDebt" in playerView(next, 1, rows, [null, null, null, null], []).players[0]));
});

test("Uhr: der Tagesbericht erklärt jede Bewegung, Summe passt, Zeitung nennt sie", async () => {
  const { total } = await import("../engine/index.ts");
  const { clockMoves } = await import("../newspaper/summary.ts");
  for (let seed = 1; seed <= 300; seed++) {
    let s = newGame(seed);
    while (!s.over) {
      const before = total(s.tracks);
      s = resolveDay(s, s.players.map((_, i) => botMove(s, i, (["kooperativ", "egoist", "taktiker"] as const)[(seed + i) % 3], () => ((seed * 7 + i) % 10) / 10)));
      const c = s.history.at(-1)!.clock!;
      assert.equal(c.crisis + c.cardsUp + c.cardsDown + c.offers + c.accusation + c.drift, total(s.history.at(-1)!.tracksAfter) - before, `Seed ${seed}, Tag ${s.history.at(-1)!.day}`);
      assert.ok(c.cardsUp >= 0 && c.cardsDown <= 0 && c.crisis >= 0 && c.offers >= 0 && c.accusation <= 0);
    }
  }
  assert.equal(clockMoves({ crisis: 2, cardsUp: 3, cardsDown: -1, offers: 1, accusation: 0, drift: 0 }),
    "Was die Uhr bewegt hat: Krise +2, Karten +3 / −1, Rotes Telefon +1 – zusammen +5 (25 Minuten).");
  assert.equal(clockMoves({ crisis: 0, cardsUp: 0, cardsDown: -2, offers: 0, accusation: 0, drift: 0 }),
    "Was die Uhr bewegt hat: Karten −2 – zusammen −2 (10 Minuten).");
  assert.equal(clockMoves({ crisis: 0, cardsUp: 0, cardsDown: 0, offers: 0, accusation: 0, drift: 0 }), "Die Uhr hat sich heute nicht bewegt.");
});
