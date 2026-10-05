// Spielzustand und reine Abfragen darauf. Keine Veränderungen, kein Text.
import { BALANCE } from "../rules/balance.ts";
import { NATION_RULES } from "../rules/nations.ts";
import { TRACKS } from "../rules/types.ts";
import type { Card, Crisis, NationId, Offer, PowerId, Track } from "../rules/types.ts";

export interface PlayerStats {
  offersAccepted: number; majorityVotes: number; dirtyPlayed: number; cleanPlayed: number;
  weakVotes: number; lateDirty: number; // öffentliche Verdachtsspuren
  saved: number; caused: number; // für Held der Vernunft / Brandstifter
}

export interface Player {
  nation: NationId;
  pk: number;
  vp: number;
  hand: Card[];
  goals: string[]; // Ziel-IDs
  intel: { nation: NationId; goal: string; day?: number }[]; // per Leak aufgedeckte Ziele anderer; day: Tag des Leaks (fehlt in alten Spielständen)
  defector: boolean;
  exposed: boolean;
  vetoUsed: boolean;
  stats: PlayerStats;
}

/** Öffentlicher Tagesbericht. Enthält keine Geheimnisse (Angebote ohne Käufer). */
export interface DayReport {
  day: number;
  crisis: string; // Krisen-ID
  crisisTrack: Track;
  votes: Partial<Record<NationId, string>>; // Response-IDs
  passed: string | null; // Response-ID
  vetoedBy: NationId | null;
  cards: { nation: NationId; card: string; target?: NationId; stolen?: number }[]; // stolen: tatsächlich genommener Einfluss
  offersTaken: PowerId[];
  accusation: { target: NationId; correct: boolean } | null;
  tracksBefore: Record<Track, number>;
  tracksAfter: Record<Track, number>;
}

export type DealtOffer = Offer & { track: Track }; // Track schon aufgelöst

export interface GameState {
  day: number;
  tracks: Record<Track, number>;
  players: Player[];
  crisis: Crisis;
  nextCrisis: Crisis;
  offers: { to: number; offer: DealtOffer }[]; // geheim: wer welches Angebot hat
  deck: Card[];
  crisisDeck: Crisis[];
  accusationUsed: boolean;
  over: boolean;
  ending?: "vernunft" | Track;
  winners?: NationId[];
  awards?: { hero: NationId[]; arsonist: NationId[] };
  history: DayReport[];
  seed: number;
  rngState: number;
}

export interface Move {
  vote: string | null; // Response-ID
  cardId: string | null;
  target?: number; // Spielerindex für Interaktionskarten
  acceptOffer?: boolean;
  defect?: boolean;
  veto?: boolean; // nur Nationen mit Veto
  accuse?: number; // Spielerindex
}

export const total = (t: Record<Track, number>) => TRACKS.reduce((s, k) => s + t[k], 0);
export const minutesLeft = (t: Record<Track, number>) => Math.max(0, BALANCE.midnightTotal - total(t)) * 5;
export const clockTime = (t: Record<Track, number>) => {
  const mins = 24 * 60 - minutesLeft(t);
  return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};
export const isMidnight = (s: GameState) => s.over && s.ending !== "vernunft";
export const topTrack = (s: GameState) => TRACKS.reduce((a, b) => s.tracks[a] >= s.tracks[b] ? a : b);

export const cardCost = (p: Player, c: Card) => Math.max(0, c.cost - (c.tracks?.krieg !== undefined ? NATION_RULES[p.nation].warCardDiscount : 0));
/** Kennt Spieler i schon alle geheimen Ziele von Spieler t? Dann brächte ein Leak gegen t nichts mehr. */
export const knowsAllGoals = (s: GameState, i: number, t: number) =>
  s.players[t].goals.every(g => s.players[i].intel.some(x => x.nation === s.players[t].nation && x.goal === g));

export const canVeto = (p: Player) => NATION_RULES[p.nation].veto && !p.vetoUsed;
export const hasForesight = (p: Player) => NATION_RULES[p.nation].foresight;
export const canDefect = (s: GameState, i: number) => !s.over && s.day >= BALANCE.defectFromDay && !s.players.some(p => p.defector)
  && s.players[i].vp < Math.max(...s.players.map(p => p.vp));
export const offerFor = (s: GameState, i: number) => s.offers.find(o => o.to === i)?.offer ?? null;
