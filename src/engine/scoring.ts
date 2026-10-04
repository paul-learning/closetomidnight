// Spielende: Mitternacht oder Überleben, Ziele, Auszeichnungen, Sieger.
import { BALANCE } from "../rules/balance.ts";
import { GOALS } from "../rules/content.ts";
import { topTrack } from "./state.ts";
import type { GameState } from "./state.ts";

export function finish(s: GameState, how: "midnight" | "survived"): GameState {
  s.over = true;
  if (how === "midnight") {
    const defector = s.players.find(p => p.defector && !p.exposed);
    s.ending = topTrack(s);
    s.winners = defector ? [defector.nation] : [];
    return s;
  }
  s.ending = "vernunft";
  const eligible = s.players.filter(p => !p.defector);
  for (const p of eligible) {
    const others = s.players.filter(q => q !== p);
    for (const id of p.goals) {
      const g = GOALS.find(x => x.id === id)!;
      if (g.check({ tracks: s.tracks, me: { pk: p.pk, ...p.stats }, others })) p.vp += g.vp;
    }
  }
  const maxSaved = Math.max(...eligible.map(p => p.stats.saved));
  const maxCaused = Math.max(...eligible.map(p => p.stats.caused));
  const hero = eligible.filter(p => maxSaved > 0 && p.stats.saved === maxSaved);
  const arsonist = eligible.filter(p => maxCaused > 0 && p.stats.caused === maxCaused);
  hero.forEach(p => p.vp += BALANCE.heroBonus);
  arsonist.forEach(p => p.vp -= BALANCE.arsonistPenalty);
  s.awards = { hero: hero.map(p => p.nation), arsonist: arsonist.map(p => p.nation) };
  const best = Math.max(...eligible.map(p => p.vp));
  const top = eligible.filter(p => p.vp === best);
  const bestPk = Math.max(...top.map(p => p.pk));
  s.winners = top.filter(p => p.pk === bestPk).map(p => p.nation);
  return s;
}
