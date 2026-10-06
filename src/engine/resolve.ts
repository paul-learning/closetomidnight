// Ein Tag von Anfang bis Ende: Phasen in fester Reihenfolge, dann Spielende oder nächster Tag.
import { BALANCE } from "../rules/balance.ts";
import { CRISES } from "../rules/content.ts";
import { TRACKS } from "../rules/types.ts";
import { accusation, cards, council, councilCosts, defections, drift, offers } from "./phases.ts";
import { rng } from "./rng.ts";
import { finish } from "./scoring.ts";
import { dealOffers } from "./setup.ts";
import { total } from "./state.ts";
import type { DayReport, GameState, Move } from "./state.ts";

/** Löst einen Tag auf. moves[i] gehört zu players[i]. Gibt einen neuen Zustand zurück; `prev` bleibt unverändert. */
export function resolveDay(prev: GameState, moves: Move[]): GameState {
  const s: GameState = structuredClone(prev);
  const rnd = rng(s.rngState);
  const rep: DayReport = { day: s.day, crisis: s.crisis.id, crisisTrack: s.crisis.track, votes: {}, passed: null, vetoedBy: null, cards: [],
    offersTaken: [], accusation: null, tracksBefore: { ...s.tracks }, tracksAfter: s.tracks,
    clock: { crisis: 0, cardsUp: 0, cardsDown: 0, offers: 0, accusation: 0, drift: 0 } };

  defections(s, moves);
  council(s, moves, rep);
  cards(s, moves, rep);
  councilCosts(s, rep);
  offers(s, moves, rep);
  accusation(s, moves, rep);
  drift(s, rnd, rep);
  rep.transferred = (s.transfers ?? []).filter(t => t.day === s.day).reduce((n, t) => n + t.amount, 0);

  rep.tracksAfter = { ...s.tracks };
  s.history.push(rep);

  if (total(s.tracks) >= BALANCE.midnightTotal || TRACKS.some(t => s.tracks[t] >= BALANCE.trackMax)) return finish(s, "midnight");
  if (s.day >= BALANCE.days) return finish(s, "survived");
  return nextDay(s, rnd);
}

function nextDay(s: GameState, rnd: () => number): GameState {
  s.day++;
  s.players.forEach(p => { p.pk += BALANCE.pkPerDay; while (p.hand.length < BALANCE.handSize && s.deck.length) p.hand.push(s.deck.shift()!); });
  s.crisis = s.nextCrisis;
  s.nextCrisis = s.crisisDeck.shift() ?? CRISES[Math.floor(rnd() * CRISES.length)];
  s.offers = dealOffers(s.day, rnd, s.crisis.track);
  s.rngState = Math.floor(rnd() * 2 ** 31);
  return s;
}
