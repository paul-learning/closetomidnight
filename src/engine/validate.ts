// Prüft einen eingereichten Zug gegen die Regeln. Fehler tragen einen Code; den Text liefert src/i18n.
import { canDefect, canVeto, cardCost, offerFor, knowsAllGoals } from "./state.ts";
import type { GameState, Move } from "./state.ts";

export type RuleErrorCode = "gameOver" | "needTarget" | "cannotDefect" | "tooExpensive" | "leakKnown" | "badTransfer" | "notEnoughFree";
export class RuleError extends Error {
  code: RuleErrorCode;
  constructor(code: RuleErrorCode) { super(code); this.code = code; }
}

export function validateMove(s: GameState, i: number, input: any): Move {
  if (s.over) throw new RuleError("gameOver");
  const p = s.players[i];
  const m = input ?? {};
  const out: Move = { vote: null, cardId: null };
  if (typeof m.vote === "string" && s.crisis.responses.some(r => r.id === m.vote)) out.vote = m.vote;
  const card = typeof m.cardId === "string" ? p.hand.find(c => c.id === m.cardId) : undefined;
  if (card) {
    if (cardCost(p, card) > p.pk) throw new RuleError("tooExpensive");
    out.cardId = card.id;
    if (card.kind === "interaktion") {
      const t = Number(m.target);
      if (!(Number.isInteger(t) && t >= 0 && t < 4 && t !== i)) throw new RuleError("needTarget");
      if (card.leak && knowsAllGoals(s, i, t)) throw new RuleError("leakKnown");
      out.target = t;
    }
  }
  if (m.acceptOffer && offerFor(s, i)) out.acceptOffer = true;
  if (m.defect) { if (!canDefect(s, i)) throw new RuleError("cannotDefect"); out.defect = true; }
  if (m.veto && canVeto(p)) out.veto = true;
  if (m.accuse !== undefined && m.accuse !== null && !s.accusationUsed) {
    const t = Number(m.accuse);
    if (Number.isInteger(t) && t >= 0 && t < 4 && t !== i) out.accuse = t;
  }
  return out;
}
