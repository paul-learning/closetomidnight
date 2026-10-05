// Was Spieler und Spielleitung sehen dürfen. Nur IDs und Zahlen; die Oberfläche setzt die Texte ein.
// Geheimnisse anderer (Ziele, Siegpunkte, Angebote, Überläufer) bleiben verborgen, bis das Spiel endet.
import { CONFIG } from "../config.ts";
import { canDefect, canVeto, cardCost, clockTime, hasForesight, minutesLeft, offerFor } from "../engine/index.ts";
import type { GameState } from "../engine/index.ts";
import { BALANCE } from "../rules/balance.ts";
import { GOALS } from "../rules/content.ts";
import type { PlayerRow, SavedMove } from "./store.ts";
import { playerUrl } from "./registration.ts";
import { aiConfigured } from "../integrations/mistral.ts";
import { subscriberCount, vapidPublicKey } from "./notifications.ts";

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
      hand: p.hand.map(c => ({ ...c, effCost: cardCost(p, c) })),
      goals: p.defector ? [{ id: "defector", kind: "schmutzig", vp: 0 }] : goalInfo(p.goals),
      intel: p.intel,
      vetoAvailable: canVeto(p),
      canDefect: canDefect(s, i),
    },
    crisis: s.crisis,
    nextCrisis: hasForesight(p) ? s.nextCrisis : null,
    offer: s.over ? null : offerFor(s, i),
    accusationUsed: s.accusationUsed,
    players: s.players.map((q, j) => ({
      idx: j, nation: q.nation, playerName: players[j].name, pk: q.pk, locked: !!moves[j]?.locked,
      ...(s.over ? { vp: q.vp, defector: q.defector, goals: goalInfo(q.goals) } : {}),
    })),
    papers,
    myMove: moves[i] ?? null,
    pushKey: vapidPublicKey(),
  };
}

export function adminView(s: GameState, game: { id: string; bots: boolean }, players: PlayerRow[], moves: (SavedMove | null)[], papers: { day: number; text: string }[]) {
  return {
    day: s.day, days: BALANCE.days, over: s.over, bots: game.bots, resolveHour: CONFIG.resolveHour,
    status: { ai: aiConfigured(), aiModel: aiConfigured() ? CONFIG.mistral.model : null, pushPlayers: subscriberCount(game.id) },
    players: players.map((pl, i) => ({ name: pl.name, nation: s.players[i].nation, url: playerUrl(pl.token), saved: !!moves[i], locked: !!moves[i]?.locked,
      hasPassword: !!pl.hasPassword })),
    papers: papers.map(p => ({ ...p, clock: clockTime(s.history.find(h => h.day === p.day)?.tracksAfter ?? s.tracks),
      midnight: s.over && s.ending !== "vernunft" && p.day === s.history.at(-1)?.day })),
  };
}
