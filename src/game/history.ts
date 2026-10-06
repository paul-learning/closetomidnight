// Spielverlauf als lesbarer Text (Markdown) für die Spielleitung: Tag für Tag, mit allen geheimen Zügen.
import { CONFIG } from "../config.ts";
import { clockTime } from "../engine/index.ts";
import type { Move } from "../engine/index.ts";
import { T, fmt } from "../i18n/index.ts";
import { BALANCE } from "../rules/balance.ts";
import { cardById } from "../rules/content.ts";
import type { NationId } from "../rules/types.ts";
import type { GameRow } from "./store.ts";
import { store } from "./store.ts";

const H = T.history;
const nation = (n: NationId) => T.nations[n].name;
const list = (ns?: NationId[]) => ns?.length ? ns.map(nation).join(", ") : H.nobody;

export function gameHistory(g: GameRow): string {
  const s = g.state, players = store.players(g.id), papers = store.papers(g.id), moves = store.allMoves(g.id);
  const nationOf = (idx: number) => nation(s.players[idx].nation);
  const status = g.cancelled ? fmt(H.statusCancelled, { day: s.day }) : s.over ? fmt(H.statusOver, { day: s.history.at(-1)?.day ?? s.day })
    : fmt(H.statusRunning, { day: s.day, days: BALANCE.days });
  const out = [H.title, "", fmt(H.created, { date: new Date(g.created || Date.now()).toLocaleDateString("de-DE", { timeZone: CONFIG.timeZone }), status }), "", H.players];
  for (const p of players) out.push(fmt(H.player, { nation: nationOf(p.idx), name: p.name }));

  // played: Karten, die die Engine an diesem Tag wirklich ausgeführt hat (öffentlicher Tagesbericht); undefined = Tag nicht aufgelöst
  const moveLines = (day: number, crisis: string, played?: { nation: NationId; card: string; blocked?: boolean }[]) => {
    const lines = [H.moves];
    for (let idx = 0; idx < s.players.length; idx++) {
      const saved = moves.find(m => m.day === day && m.idx === idx);
      const ran = played && saved?.move.cardId ? played.some(c => c.nation === s.players[idx].nation && c.card === saved.move.cardId) : true;
      const fizzled = !!played?.some(c => c.nation === s.players[idx].nation && c.blocked);
      const parts = saved ? describe(saved.move, crisis, nationOf, ran) + (fizzled ? ` ${H.blocked}` : "") + (saved.locked ? "" : ` ${H.notLocked}`) : played ? H.noMoveResolved : H.noMove;
      lines.push(fmt(H.move, { nation: nationOf(idx), parts }));
    }
    return lines;
  };

  // Überweisungen eines Tages, mit Betreff (die Spielleitung sieht alle geheimen Züge)
  const transferLines = (day: number) => {
    const ts = (s.transfers ?? []).filter(t => t.day === day);
    return ts.length ? ["", H.transfers, ...ts.map(t => fmt(t.subject ? H.transferSubject : H.transfer,
      { from: nationOf(t.from), to: nationOf(t.to), amount: t.amount, subject: t.subject }))] : [];
  };

  for (const r of s.history) {
    out.push("", fmt(H.day, { day: r.day, crisis: T.crises[r.crisis].name }));
    out.push(r.passed ? fmt(H.passed, { response: T.crises[r.crisis].responses[r.passed] }) : r.vetoedBy ? fmt(H.vetoed, { nation: nation(r.vetoedBy) }) : H.noDeal);
    out.push(fmt(H.clock, { time: clockTime(r.tracksAfter), ...r.tracksAfter }), "", ...moveLines(r.day, r.crisis, r.cards), ...transferLines(r.day));
    if (r.accusation) out.push("", fmt(r.accusation.correct ? H.exposed : H.falseSuspicion, { nation: nation(r.accusation.target) }));
    const paper = papers.find(p => p.day === r.day);
    if (paper) out.push("", H.paper, "", ...paper.text.split("\n").map(l => `> ${l}`));
  }
  // Laufender (oder beim Abbruch offener) Tag: gespeicherte Züge, noch ohne Ergebnis
  if (!s.over && (moves.some(m => m.day === s.day) || (s.transfers ?? []).some(t => t.day === s.day))) out.push("", fmt(H.dayOpen, { day: s.day, crisis: T.crises[s.crisis.id].name }), ...moveLines(s.day, s.crisis.id), ...transferLines(s.day));

  if (s.over) {
    out.push("", H.result, fmt(H.ending, { ending: T.endings[s.ending!] }), fmt(H.winners, { names: list(s.winners) }));
    if (s.awards) out.push(fmt(H.hero, { names: list(s.awards.hero) }), fmt(H.arsonist, { names: list(s.awards.arsonist) }));
    out.push(fmt(H.defectors, { names: list(s.players.filter(q => q.defector).map(q => q.nation)) }));
    out.push("");
    s.players.forEach((q, idx) => {
      out.push(fmt(H.score, { nation: nation(q.nation), name: players.find(p => p.idx === idx)?.name ?? "", vp: q.vp, pk: q.pk, defector: q.defector ? H.defector : "" }));
      out.push(fmt(H.goals, { goals: q.goals.map(id => T.goals[id]).join(" · ") }));
    });
  }
  return out.join("\n") + "\n";
}

function describe(m: Move, crisis: string, nationOf: (i: number) => string, cardRan: boolean): string {
  const parts = [m.vote ? fmt(H.vote, { response: T.crises[crisis]?.responses[m.vote] ?? m.vote }) : H.noVote];
  if (m.cardId) {
    const card = T.cards[m.cardId] ?? m.cardId;
    const needsTarget = cardById(m.cardId)?.kind === "interaktion";
    parts.push((needsTarget && m.target !== undefined ? fmt(H.cardAgainst, { card, target: nationOf(m.target) }) : fmt(H.card, { card })) + (cardRan ? "" : ` ${H.notPlayed}`));
  }
  if (m.acceptOffer) parts.push(H.offer);
  if (m.defect) parts.push(H.defect);
  if (m.veto) parts.push(H.veto);
  if (m.accuse !== undefined) parts.push(fmt(H.accuse, { target: nationOf(m.accuse) }));
  return parts.join(" · ");
}
