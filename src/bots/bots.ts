// Bot-Spieler: für den Simulator und als Ersatz für fehlende Züge im echten Spiel. Kennt nur Regeln, keine Texte.
import { TRACKS } from "../rules/types.ts";
import type { Card, Track } from "../rules/types.ts";
import { BALANCE } from "../rules/balance.ts";
import { canDefect, cardCost, total, knowsAllGoals } from "../engine/index.ts";
import type { GameState, Move } from "../engine/index.ts";

export type Persona = "kooperativ" | "egoist" | "taktiker";
export const PERSONAS: Persona[] = ["kooperativ", "egoist", "taktiker"];

export function botMove(s: GameState, i: number, persona: Persona, rnd: () => number): Move {
  const p = s.players[i];
  const danger = total(s.tracks); // 24 = Mitternacht
  const top = TRACKS.reduce((a, b) => s.tracks[a] >= s.tracks[b] ? a : b) as Track;
  const selfish = p.defector || persona === "egoist" || (persona === "taktiker" && danger < 16);
  const leaderGap = Math.max(...s.players.map(q => q.vp)) - p.vp;

  // Überlaufen?
  const defect = !p.defector && canDefect(s, i) && persona !== "kooperativ" && leaderGap >= 4 && danger >= 17 && rnd() < 0.5;
  const isDef = p.defector || defect;

  // Abstimmung
  const rs = s.crisis.responses;
  let vote: string;
  if (isDef) vote = rs[rs.length - 1].id; // so wenig Hilfe wie möglich
  else if (!selfish) vote = (p.pk >= rs[0].costEach ? rs[0] : rs[1]).id;
  else vote = (rs.find(r => r.bonus?.nation === p.nation) ?? rs[1]).id;

  // Karte: jede Karte bekommt je nach Haltung einen Wert; gespielt wird die beste bezahlbare.
  // Ist eine deutlich bessere Karte morgen bezahlbar, wird heute gespart.
  const value = (c: Card) => {
    const tr = c.tracks ?? {};
    const doom = TRACKS.reduce((n, t) => n + Math.max(0, tr[t] ?? 0), 0);
    const clean = TRACKS.reduce((n, t) => n - Math.min(0, tr[t] ?? 0) * (t === top ? 1.5 : 1), 0);
    const harm = (c.steal ?? 0) + (c.sanction ?? 0) * 1.5 + (c.block ? 2 : 0) + Number(c.leak ?? 0) * 0.5;
    const gain = (c.vp ?? 0) + (c.pk ?? 0) * 0.5 + (c.everyonePk ?? 0) * 0.3;
    if (isDef) return c.kind === "sauber" ? -1 : gain + harm + doom;
    if (!selfish) return doom > 0 || c.kind === "interaktion" ? -1 : clean * 3 + (c.vp ?? 0) * 0.5 + (c.everyonePk ?? 0);
    return gain + harm - doom * (danger >= 20 ? 3 : 0.5);
  };
  const reserve = selfish ? 0 : 2;
  const ranked = p.hand.map(c => ({ c, v: value(c), cost: cardCost(p, c) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  const bestNow = ranked.find(x => x.cost <= p.pk - reserve);
  const saveFor = ranked.find(x => x.cost > p.pk - reserve && x.cost <= p.pk - reserve + BALANCE.pkPerDay && s.day < BALANCE.days);
  let card = bestNow && !(saveFor && saveFor.v > bestNow.v * 1.6) ? bestNow.c : null as Card | null;
  // Ziel: wer am meisten Einfluss hat (öffentlich sichtbar). Bei einem Leak nur, wessen Ziele noch nicht alle bekannt sind.
  const targets = s.players.map((q, j) => [q.pk, j]).filter(([, j]) => j !== i && !(card?.leak && knowsAllGoals(s, i, j)));
  if (card?.kind === "interaktion" && !targets.length) card = null;
  const target = targets.sort((a, b) => b[0] - a[0])[0]?.[1];

  // Misstrauensvotum: öffentliche Spuren (schwache Stimmen, späte schmutzige Karten)
  let accuse: number | undefined;
  if (!s.accusationUsed && s.day >= 4 && danger >= 15) {
    const sus = s.players.map((q, j) => ({ j, v: j === i ? -1 : q.stats.weakVotes * 2 + q.stats.lateDirty * 2 + q.stats.dirtyPlayed })).sort((a, b) => b.v - a.v);
    if (isDef) accuse = sus[0].j; // Überläufer lenkt ab
    else if ((persona !== "egoist" || danger >= 18) && sus[0].v >= 5 && sus[0].v > sus[1].v) accuse = sus[0].j;
  }
  const acceptOffer = isDef || (selfish && danger < 21) || (persona === "taktiker" && rnd() < 0.2);
  return { vote, cardId: card?.id ?? null, target, acceptOffer, defect, accuse };
}

