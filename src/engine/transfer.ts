// Überweisungen zwischen Spielern: sofort, während des Tages. Was dafür gezahlt wird, erzwingt das Spiel nicht.
import { cardCost } from "./state.ts";
import type { GameState, Move } from "./state.ts";
import { RuleError } from "./validate.ts";

export interface Transfer { day: number; from: number; to: number; amount: number; subject: string }
export const SUBJECT_MAX = 60;

/** Einfluss, den der gespeicherte Zug braucht: die gewählte Karte und die Kosten der gewählten Ratsoption. */
export function reservedPk(s: GameState, i: number, move: Move | null | undefined): number {
  if (!move) return 0;
  const p = s.players[i];
  const card = move.cardId ? p.hand.find(c => c.id === move.cardId) : undefined;
  const vote = move.vote ? s.crisis.responses.find(r => r.id === move.vote) : undefined;
  return (card ? cardCost(p, card) : 0) + (vote?.costEach ?? 0);
}

/** Was Spieler i heute verschenken darf, ohne seinen eigenen Zug zu gefährden. */
export const freePk = (s: GameState, i: number, move: Move | null | undefined) => Math.max(0, s.players[i].pk - reservedPk(s, i, move));

/** Betreff: einzeilig, ohne Steuerzeichen, gekürzt. */
export const cleanSubject = (v: unknown) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, SUBJECT_MAX) : "";

/** Überweist Einfluss von `from` an `input.to`. Gibt einen neuen Zustand zurück; `prev` bleibt unverändert. */
export function transfer(prev: GameState, from: number, input: any, move: Move | null | undefined): GameState {
  if (prev.over) throw new RuleError("gameOver");
  const to = input?.to, amount = input?.amount;
  if (!Number.isInteger(to) || to < 0 || to >= prev.players.length || to === from) throw new RuleError("badTransfer");
  if (!Number.isInteger(amount) || amount < 1) throw new RuleError("badTransfer");
  if (amount > freePk(prev, from, move)) throw new RuleError("notEnoughFree");
  const s = structuredClone(prev);
  s.players[from].pk -= amount;
  s.players[to].pk += amount;
  (s.transfers ??= []).push({ day: s.day, from, to, amount, subject: cleanSubject(input.subject) });
  return s;
}
