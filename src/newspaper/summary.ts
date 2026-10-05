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
  if (r.accusation) lines.push(fmt(r.accusation.correct ? P.exposed : P.falseSuspicion, { nation: nation(r.accusation.target) }));
  lines.push("", fmt(P.clock, { time: time(s, r), ...r.tracksAfter }));
  if (s.over) {
    lines.push("", fmt(P.end, { ending: T.endings[s.ending!] }), fmt(P.winners, { names: nations(s.winners) }));
    if (s.awards) lines.push(fmt(P.hero, { names: nations(s.awards.hero) }), fmt(P.arsonist, { names: nations(s.awards.arsonist) }));
  } else lines.push(fmt(P.nextCrisis, { crisis: crisisName(s.crisis.id) }));
  return lines.join("\n");
}
