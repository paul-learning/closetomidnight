// Was Spieler und Spielleitung sehen dürfen. Nur IDs und Zahlen; die Oberfläche setzt die Texte ein.
// Geheimnisse anderer (Ziele, Siegpunkte, Angebote, Überläufer) bleiben verborgen, bis das Spiel endet.
import { CONFIG } from "../config.ts";
import { canDefect, canVeto, cardCost, clockTime, hasForesight, knowsAllGoals, minutesLeft, offerFor } from "../engine/index.ts";
import type { GameState } from "../engine/index.ts";
import { BALANCE } from "../rules/balance.ts";
import { GOALS, cardById, cardTier } from "../rules/content.ts";
import type { PlayerRow, SavedMove } from "./store.ts";
import { playerUrl } from "./registration.ts";
import { aiConfigured, aiLabel } from "../integrations/ai.ts";
import { subscriberCount, vapidPublicKey } from "./notifications.ts";

/**
 * Was dem Spieler am zuletzt aufgelösten Tag angetan wurde: Karten gegen ihn und eine Anklage.
 * Nur Öffentliches aus dem Tagesbericht – wer angeklagt hat, bleibt geheim.
 */
export function incomingFor(s: GameState, i: number) {
  const r = s.history.at(-1), me = s.players[i].nation;
  if (!r) return null;
  const mine = r.cards.find(c => c.nation === me);
  const cards = r.cards.filter(c => c.target === me).map(c => {
    const def = cardById(c.card);
    return {
      nation: c.nation, card: c.card, fizzled: !!c.blocked, stolen: c.stolen ?? null, vpLost: def?.sanction ?? null,
      leaked: def?.leak ? Number(def.leak) : null,
      // Blockade: ist meine Karte verpufft, oder hatte ich gar keine gespielt?
      blockedMine: def?.block ? !!mine?.blocked : null,
    };
  });
  const accused = r.accusation?.target === me ? { correct: r.accusation.correct } : null;
  return cards.length || accused ? { day: r.day, cards, accused } : null;
}

const goalInfo = (ids: string[]) => ids.map(id => { const g = GOALS.find(x => x.id === id)!; return { id, kind: g.kind, vp: g.vp }; });

export function playerView(s: GameState, i: number, players: PlayerRow[], moves: (SavedMove | null)[], papers: { day: number; text: string }[]) {
  const p = s.players[i];
  return {
    rules: {
      days: BALANCE.days, trackMax: BALANCE.trackMax, votesNeeded: BALANCE.votesNeeded, votesNeededStrong: BALANCE.votesNeededStrong,
      defectFromDay: BALANCE.defectFromDay, defectorBonusPk: BALANCE.defectorBonusPk,
      accuseVotesNeeded: BALANCE.accuseVotesNeeded, accuseWrongPenalty: BALANCE.accuseWrongPenalty, resolveHour: CONFIG.resolveHour,
    },
    day: s.day, clock: clockTime(s.tracks), minutesLeft: minutesLeft(s.tracks), tracks: s.tracks,
    over: s.over, ending: s.ending ?? null, winners: s.winners ?? [], awards: s.awards ?? null,
    me: {
      idx: i, nation: p.nation, playerName: players[i].name, pk: p.pk, vp: p.vp, defector: p.defector, exposed: p.exposed,
      hand: p.hand.map(c => ({ ...c, effCost: cardCost(p, c), tier: cardTier(c) })),
      goals: p.defector ? [{ id: "defector", kind: "schmutzig", vp: 0 }] : goalInfo(p.goals),
      intel: p.intel,
      // Was der eigene Leak am zuletzt aufgelösten Tag ergeben hat (eigener Kasten oben auf der Seite)
      intelNew: p.intel.filter(x => x.day !== undefined && x.day === s.history.at(-1)?.day).map(x => ({ ...goalInfo([x.goal])[0], nation: x.nation, day: x.day })),
      vetoAvailable: canVeto(p),
      canDefect: canDefect(s, i),
    },
    crisis: s.crisis,
    nextCrisis: hasForesight(p) ? s.nextCrisis : null,
    offer: s.over ? null : offerFor(s, i),
    accusationUsed: s.accusationUsed,
    players: s.players.map((q, j) => ({
      idx: j, nation: q.nation, playerName: players[j].name, pk: q.pk, locked: !!moves[j]?.locked,
      allGoalsKnown: j !== i && knowsAllGoals(s, i, j), // für den Leak: Ziel nicht mehr wählbar
      ...(s.over ? { vp: q.vp, defector: q.defector, goals: goalInfo(q.goals) } : {}),
    })),
    papers,
    incoming: incomingFor(s, i),
    myMove: moves[i] ?? null,
    pushKey: vapidPublicKey(),
  };
}

export function adminView(s: GameState, game: { id: string; bots: boolean }, players: PlayerRow[], moves: (SavedMove | null)[], papers: { day: number; text: string }[]) {
  return {
    day: s.day, days: BALANCE.days, over: s.over, bots: game.bots, resolveHour: CONFIG.resolveHour,
    status: { ai: aiConfigured(), aiModel: aiConfigured() ? aiLabel() : null, pushPlayers: subscriberCount(game.id) },
    players: players.map((pl, i) => ({ name: pl.name, nation: s.players[i].nation, url: playerUrl(pl.token), saved: !!moves[i], locked: !!moves[i]?.locked,
      hasPassword: !!pl.hasPassword })),
    papers: papers.map(p => ({ ...p, clock: clockTime(s.history.find(h => h.day === p.day)?.tracksAfter ?? s.tracks),
      midnight: s.over && s.ending !== "vernunft" && p.day === s.history.at(-1)?.day })),
  };
}
