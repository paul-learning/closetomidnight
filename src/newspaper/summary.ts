// Schlichte Zeitung ohne KI: Fakten des Tages, eine Zeile pro Ereignis.
import type { DayReport, GameState } from "../engine/index.ts";
import { T, fmt } from "../i18n/index.ts";
import type { NationId } from "../rules/types.ts";
import { crisisName, nation, nations, power, responseName, time } from "./names.ts";

export function plainSummary(s: GameState, r: DayReport): string {
  const P = T.paper;
  const lines = [fmt(P.title, { day: r.day }), "", fmt(P.crisis, { crisis: crisisName(r.crisis) })];
  if (r.passed) lines.push(fmt(P.passed, { response: responseName(r.crisis, r.passed) }));
  else lines.push(r.vetoedBy ? fmt(P.vetoed, { nation: nation(r.vetoedBy) }) : P.noDeal);
  for (const [n, v] of Object.entries(r.votes)) lines.push(fmt(P.voted, { nation: nation(n as NationId), response: responseName(r.crisis, v!) }));
  for (const c of r.cards) lines.push(fmt(c.target ? P.playedAgainst : P.played, { nation: nation(c.nation), card: T.cards[c.card] ?? c.card, target: c.target ? nation(c.target) : "" }) + (c.blocked ? ` ${P.blocked}` : ""));
  for (const o of r.offersTaken) lines.push(fmt(P.rumour, { power: power(o) }));
  if (r.transferred) lines.push(fmt(P.transferred, { n: r.transferred }));
  if (r.accusation) lines.push(fmt(r.accusation.correct ? P.exposed : P.falseSuspicion, { nation: nation(r.accusation.target) }));
  lines.push("", fmt(P.clock, { time: time(s, r), ...r.tracksAfter }));
  if (r.clock) lines.push(clockMoves(r.clock));
  if (s.over) {
    lines.push("", fmt(P.end, { ending: T.endings[s.ending!] }), fmt(P.winners, { names: nations(s.winners) }));
    if (s.awards) lines.push(fmt(P.hero, { names: nations(s.awards.hero) }), fmt(P.arsonist, { names: nations(s.awards.arsonist) }));
  } else lines.push(fmt(P.nextCrisis, { crisis: crisisName(s.crisis.id) }));
  return lines.join("\n");
}

/** „Was die Uhr bewegt hat: Krise +2, Karten +3 / −1, Telefon +1 – zusammen +4 (20 Minuten)“ */
export function clockMoves(c: NonNullable<DayReport["clock"]>): string {
  const P = T.paper, sign = (n: number) => (n > 0 ? "+" : "−") + Math.abs(n);
  const parts = [
    c.crisis && fmt(P.moveCrisis, { n: sign(c.crisis) }),
    (c.cardsUp || c.cardsDown) && fmt(P.moveCards, { n: [c.cardsUp && sign(c.cardsUp), c.cardsDown && sign(c.cardsDown)].filter(Boolean).join(" / ") }),
    c.offers && fmt(P.moveOffers, { n: sign(c.offers) }),
    c.accusation && fmt(P.moveAccusation, { n: sign(c.accusation) }),
    c.drift && fmt(P.moveDrift, { n: sign(c.drift) }),
  ].filter(Boolean);
  const net = c.crisis + c.cardsUp + c.cardsDown + c.offers + c.accusation + c.drift;
  if (!parts.length) return P.moveNone;
  return fmt(P.moves, { parts: parts.join(", "), net: net ? sign(net) : "±0", minutes: Math.abs(net) * 5 });
}
