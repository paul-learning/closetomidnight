// Auftrag an die KI: die Fakten des Tages und der bisherigen Tage, nichts Geheimes.
import { clockTime } from "../engine/index.ts";
import type { DayReport, GameState } from "../engine/index.ts";
import { T, fmt } from "../i18n/index.ts";
import type { NationId } from "../rules/types.ts";
import { crisisName, nation, nations, power, responseName, time } from "./names.ts";

function decision(r: DayReport): string {
  if (r.passed) return responseName(r.crisis, r.passed);
  return r.vetoedBy ? fmt(T.prompt.vetoDecision, { nation: nation(r.vetoedBy) }) : T.prompt.noDecision;
}

export function prompt(s: GameState, r: DayReport): string {
  const Q = T.prompt;
  const cardList = (d: DayReport) => d.cards.map(c => `${nation(c.nation)}: ${T.cards[c.card] ?? c.card}${c.target ? ` → ${nation(c.target)}` : ""}${c.blocked ? ` (${Q.blocked})` : ""}`).join("; ") || Q.none;
  const earlier = s.history.slice(0, -1).map(h => fmt(Q.earlierDay, { day: h.day, crisis: crisisName(h.crisis), decision: decision(h), cards: cardList(h) }));
  return [
    fmt(Q.intro, { day: r.day, time: time(s, r) }), "", Q.today,
    fmt(Q.crisis, { crisis: crisisName(r.crisis), track: T.tracks[r.crisisTrack] }),
    fmt(Q.votes, { list: Object.entries(r.votes).map(([n, v]) => `${nation(n as NationId)}: ${responseName(r.crisis, v!)}`).join("; ") || Q.noVotes }),
    fmt(Q.decision, { decision: decision(r) }),
    fmt(Q.cards, { list: cardList(r) }),
    fmt(Q.offers, { list: r.offersTaken.length ? fmt(Q.offersUnknownBuyer, { list: r.offersTaken.map(power).join(", ") }) : Q.none }),
    fmt(Q.transfers, { text: r.transferred ? fmt(Q.transferredSum, { n: r.transferred }) : Q.none }),
    fmt(Q.accusation, { text: r.accusation ? fmt(r.accusation.correct ? Q.accusedRight : Q.accusedWrong, { nation: nation(r.accusation.target) }) : Q.none }),
    fmt(Q.clock, { before: clockTime(r.tracksBefore), after: time(s, r), ...r.tracksAfter }),
    s.over ? fmt(Q.final, { ending: T.endings[s.ending!], winners: nations(s.winners), hero: nations(s.awards?.hero), arsonist: nations(s.awards?.arsonist) })
      : fmt(Q.tomorrow, { crisis: crisisName(s.crisis.id) }),
    "", Q.earlier, earlier.join("\n") || Q.none,
  ].join("\n");
}
