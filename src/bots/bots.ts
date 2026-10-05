// Bot-Spieler: für den Simulator und als Ersatz für fehlende Züge im echten Spiel. Kennt nur Regeln, keine Texte.
import { TRACKS } from "../rules/types.ts";
import type { Track } from "../rules/types.ts";
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

  // Karte
  const affordable = p.hand.filter(c => cardCost(p, c) <= p.pk - (selfish ? 0 : 2));
  let card = null as null | (typeof p.hand)[number];
  if (isDef) card = affordable.find(c => c.kind === "schmutzig") ?? null;
  else if (!selfish) card = affordable.find(c => c.kind === "sauber" && (c.tracks?.[top] ?? 0) < 0) ?? affordable.find(c => c.kind === "sauber") ?? null;
  else card = affordable.find(c => c.kind === "schmutzig") ?? affordable.find(c => c.kind === "interaktion") ?? affordable[0] ?? null;
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

