// Spielablauf: Züge speichern, Tage auflösen, Zeitung verteilen. Verbindet Engine, Speicher und Integrationen.
import { resolveDay } from "../engine/index.ts";
import type { GameRow } from "./store.ts";
import { validateMove } from "../engine/index.ts";
import { botMove } from "../bots/bots.ts";
import { notifyNewEdition } from "./notifications.ts";
import { writePaper } from "../newspaper/paper.ts";
import { store } from "./store.ts";
import { localNow } from "./time.ts";

export class GameCancelled extends Error {}

export function saveMove(game: GameRow, idx: number, input: unknown, lock: boolean) {
  if (game.cancelled) throw new GameCancelled();
  const move = validateMove(game.state, idx, input);
  store.saveMove(game.id, game.state.day, idx, move, lock);
}

const resolving = new Set<string>(); // verhindert doppelte Auflösung (Zeitplan + Knopf gleichzeitig)

export async function resolveGame(gameId: string): Promise<void> {
  if (resolving.has(gameId)) return;
  resolving.add(gameId);
  try {
    const game = store.game(gameId);
    if (!game || game.state.over || game.cancelled) return;
    const s = game.state;
    const saved = store.moves(gameId, s.day);
    const moves = s.players.map((_, i) => saved[i]?.move ?? (game.bots ? botMove(s, i, "taktiker", Math.random) : { vote: null, cardId: null }));
    const next = resolveDay(s, moves);
    const report = next.history.at(-1)!;
    const text = await writePaper(next, report); // kann dauern (KI)
    // Während die Zeitung entstand, abgebrochen? Dann nichts speichern und niemanden benachrichtigen.
    if (store.isCancelled(gameId)) return;
    store.transaction(() => { store.saveState(gameId, next, localNow().date); store.savePaper(gameId, report.day, text); });
    await notifyNewEdition(gameId, next);
  } finally {
    resolving.delete(gameId);
  }
}

/** Spiel abbrechen: keine Auflösung, keine Erinnerungen, keine Züge mehr. Lässt sich nicht rückgängig machen. */
export function cancelGame(gameId: string) {
  store.cancelGame(gameId);
}

/** Einstellungen der Spielleitung übernehmen; Unbekanntes wird ignoriert. */
export function updateSettings(gameId: string, input: any) {
  if (typeof input?.bots === "boolean") store.setBots(gameId, input.bots);
  if (Array.isArray(input?.names)) input.names.slice(0, 4).forEach((n: unknown, i: number) => {
    if (typeof n === "string" && n.trim()) store.renamePlayer(gameId, i, n.trim().slice(0, 40));
  });
}
