// Die Phasen eines Tages, in der Reihenfolge, in der resolve.ts sie aufruft.
// Jede Phase verändert den (bereits kopierten) Zustand und trägt Öffentliches in den Tagesbericht ein.
import { BALANCE } from "../rules/balance.ts";
import { TRACKS } from "../rules/types.ts";
import type { Response, Track } from "../rules/types.ts";
import { canDefect, canVeto, cardCost, topTrack } from "./state.ts";
import type { DayReport, GameState, Move, Player } from "./state.ts";

export const bump = (s: GameState, t: Track, d: number) => { s.tracks[t] = Math.max(0, Math.min(BALANCE.trackMax, s.tracks[t] + d)); };
const pay = (p: Player, amount: number) => { const paid = Math.min(p.pk, amount); p.pk -= paid; p.vp -= amount - paid; };

/** 0. Überlaufen (geheim) */
export function defections(s: GameState, moves: Move[]) {
  moves.forEach((m, i) => { if (m.defect && canDefect(s, i)) { s.players[i].defector = true; s.players[i].pk += BALANCE.defectorBonusPk; } });
}

/** 1. Ratsabstimmung (Stimmen sind öffentlich), dann trifft die Krise. */
export function council(s: GameState, moves: Move[], rep: DayReport) {
  const responses = s.crisis.responses;
  moves.forEach((m, i) => {
    if (!m.vote || !responses.some(r => r.id === m.vote)) return;
    rep.votes[s.players[i].nation] = m.vote;
    if (m.vote === responses.at(-1)!.id) s.players[i].stats.weakVotes++;
  });
  const count = (id: string) => moves.filter(m => m.vote === id).length;
  let passed: Response | undefined = responses
    .filter(r => count(r.id) >= (r.unanimous ? BALANCE.votesNeededStrong : BALANCE.votesNeeded))
    .sort((a, b) => b.reduce - a.reduce)[0];
  const vetoer = moves.findIndex((m, i) => m.veto && canVeto(s.players[i]));
  if (passed && vetoer >= 0) { s.players[vetoer].vetoUsed = true; rep.vetoedBy = s.players[vetoer].nation; passed = undefined; }

  let hit = s.crisis.severity;
  if (passed) {
    const p0 = passed;
    hit -= p0.reduce;
    if (p0.bonus) s.players.find(p => p.nation === p0.bonus!.nation)!.vp += p0.bonus.vp;
    moves.forEach((m, i) => { if (m.vote === p0.id) { s.players[i].stats.majorityVotes++; s.players[i].stats.saved += p0.reduce / 2; } });
    rep.passed = p0.id;
  }
  bump(s, s.crisis.track, Math.max(0, hit));
}

/** 2. Nationale Aktionen: jede Nation spielt höchstens eine Karte.
 *  Erst zahlen alle ihre Karten, dann wirken sie – so kann ein Diebstahl keine fremde Karte mehr verhindern. */
export function cards(s: GameState, moves: Move[], rep: DayReport) {
  const played = moves.map((m, i) => {
    const p = s.players[i]; if (!m.cardId) return null;
    const idx = p.hand.findIndex(c => c.id === m.cardId); if (idx < 0) return null;
    const c = p.hand[idx]; const cost = cardCost(p, c); if (p.pk < cost) return null;
    const target = m.target !== undefined && m.target !== i && m.target >= 0 && m.target < 4 ? s.players[m.target] : undefined;
    const interactive = !!(c.steal || c.leak);
    if (interactive && !target) return null;
    p.hand.splice(idx, 1); p.pk -= cost;
    return { p, c, target, interactive };
  });

  for (const play of played) {
    if (!play) continue;
    const { p, c, target, interactive } = play;
    p.vp += c.vp ?? 0; p.pk += c.pk ?? 0;
    for (const t of TRACKS) {
      const d = c.tracks?.[t]; if (!d) continue;
      bump(s, t, d); if (d < 0) p.stats.saved -= d; else p.stats.caused += d;
    }
    if (c.kind === "schmutzig") { p.stats.dirtyPlayed++; if (s.day >= BALANCE.defectFromDay) p.stats.lateDirty++; }
    if (c.kind === "sauber") p.stats.cleanPlayed++;
    if (c.steal && target) { const n = Math.min(target.pk, c.steal); target.pk -= n; p.pk += n; }
    if (c.leak && target) {
      const goal = target.goals.find(g => !p.intel.some(x => x.nation === target.nation && x.goal === g));
      if (goal) p.intel.push({ nation: target.nation, goal });
    }
    rep.cards.push({ nation: p.nation, card: c.id, target: interactive ? target?.nation : undefined });
  }
}

/** 2b. Kosten des Ratsbeschlusses: erst nach den Karten, damit eine festgelegte Karte nie am Beschluss scheitert. */
export function councilCosts(s: GameState, rep: DayReport) {
  const passed = s.crisis.responses.find(r => r.id === rep.passed);
  if (passed) s.players.forEach(p => pay(p, passed.costEach));
}

/** 3. Angebote der Großmächte: öffentlich wird nur, wer gekauft hat, nicht wen. */
export function offers(s: GameState, moves: Move[], rep: DayReport) {
  for (const { to, offer } of s.offers) {
    if (!moves[to]?.acceptOffer) continue;
    const p = s.players[to];
    p.vp += offer.vp; p.pk += offer.pk; p.stats.offersAccepted++; p.stats.caused += offer.doom; bump(s, offer.track, offer.doom);
    rep.offersTaken.push(offer.power);
  }
}

/** 4. Misstrauensvotum: einmal pro Spiel; eine Mehrheit der anderen muss denselben anklagen. */
export function accusation(s: GameState, moves: Move[], rep: DayReport) {
  if (s.accusationUsed) return;
  for (let t = 0; t < 4; t++) {
    const accusers = moves.filter((m, i) => i !== t && m.accuse === t).length;
    if (accusers < BALANCE.accuseVotesNeeded) continue;
    s.accusationUsed = true;
    const correct = s.players[t].defector;
    if (correct) { s.players[t].exposed = true; bump(s, topTrack(s), -BALANCE.accuseRightClockBack); }
    else moves.forEach((m, i) => { if (m.accuse === t && i !== t) s.players[i].vp -= BALANCE.accuseWrongPenalty; });
    rep.accusation = { target: s.players[t].nation, correct };
    return;
  }
}

/** 5. Großmächte treiben die Uhr zufällig (im Modus "drei" abgeschaltet). */
export function drift(s: GameState, rnd: () => number) {
  for (let k = 0; k < BALANCE.strongmanDriftPerDay; k++) bump(s, TRACKS[Math.floor(rnd() * 3)], 1);
}
