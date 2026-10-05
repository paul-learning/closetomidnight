// Speicherung in SQLite. Nur hier steht SQL.
import { DatabaseSync } from "node:sqlite";
import { CONFIG } from "../config.ts";
import type { GameState, Move } from "../engine/index.ts";

export interface GameRow { id: string; adminKey: string; state: GameState; bots: boolean; lastResolved: string | null; lastReminded: string | null; cancelled: boolean; created: number }
export interface PlayerRow { token: string; gameId: string; idx: number; name: string; hasPassword?: boolean }
export interface SavedMove { move: Move; locked: boolean }
export interface PushSub { endpoint: string; gameId: string; idx: number; p256dh: string; auth: string }

const db = new DatabaseSync(CONFIG.dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, admin_key TEXT UNIQUE, state TEXT, bots INTEGER DEFAULT 0,
    last_resolved TEXT, last_reminded TEXT, created INTEGER);
  CREATE TABLE IF NOT EXISTS players (token TEXT PRIMARY KEY, game_id TEXT, idx INTEGER, name TEXT);
  CREATE TABLE IF NOT EXISTS moves (game_id TEXT, day INTEGER, idx INTEGER, move TEXT, locked INTEGER, PRIMARY KEY (game_id, day, idx));
  CREATE TABLE IF NOT EXISTS papers (game_id TEXT, day INTEGER, text TEXT, PRIMARY KEY (game_id, day));
  CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, game_id TEXT, idx INTEGER, p256dh TEXT, auth TEXT, created INTEGER);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER, secret_fp TEXT);
`);
// Alte Datenbanken: ungenutzte Spalte aus einer früheren Version entfernen
if ((db.prepare("PRAGMA table_info(games)").all() as { name: string }[]).some(c => c.name === "chat_id")) db.exec("ALTER TABLE games DROP COLUMN chat_id");
// Anmeldungen der Spielleitung aus einer Vorversion ohne Passwort-Fingerabdruck: Spalte ergänzen.
// Solche alten Anmeldungen (secret_fp leer) gelten nicht mehr; einmal neu anmelden.
if (!(db.prepare("PRAGMA table_info(admin_sessions)").all() as { name: string }[]).some(c => c.name === "secret_fp")) db.exec("ALTER TABLE admin_sessions ADD COLUMN secret_fp TEXT");
// Abgebrochene Spiele: laufen nicht weiter, die Startseite behandelt sie wie „kein Spiel“
if (!(db.prepare("PRAGMA table_info(games)").all() as { name: string }[]).some(c => c.name === "cancelled")) db.exec("ALTER TABLE games ADD COLUMN cancelled INTEGER DEFAULT 0");
// Passwörter für die Startseite (nur Hash, siehe game/passwords.ts)
if (!(db.prepare("PRAGMA table_info(players)").all() as { name: string }[]).some(c => c.name === "pw_hash")) db.exec("ALTER TABLE players ADD COLUMN pw_hash TEXT");

const toGame = (r: any): GameRow | undefined => r && {
  id: r.id, adminKey: r.admin_key, state: JSON.parse(r.state), bots: !!r.bots, lastResolved: r.last_resolved, lastReminded: r.last_reminded, cancelled: !!r.cancelled, created: r.created ?? 0,
};
// Der Hash selbst verlässt store.ts nur über passwordHash(), für die Anmeldung.
const toPlayer = (r: any): PlayerRow | undefined => r && { token: r.token, gameId: r.game_id, idx: r.idx, name: r.name, hasPassword: r.pw_hash != null };

export const store = {
  /** Führt fn ganz oder gar nicht aus. */
  transaction<T>(fn: () => T): T {
    db.exec("BEGIN");
    try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
  },
  insertGame(g: { id: string; adminKey: string; state: GameState; bots: boolean; lastResolved: string | null }) {
    db.prepare("INSERT INTO games (id, admin_key, state, bots, last_resolved, created) VALUES (?, ?, ?, ?, ?, ?)")
      .run(g.id, g.adminKey, JSON.stringify(g.state), g.bots ? 1 : 0, g.lastResolved, Date.now());
  },
  insertPlayer(p: PlayerRow) {
    db.prepare("INSERT INTO players (token, game_id, idx, name) VALUES (?, ?, ?, ?)").run(p.token, p.gameId, p.idx, p.name);
  },
  game: (id: string) => toGame(db.prepare("SELECT * FROM games WHERE id = ?").get(id)),
  gameByAdminKey: (key: string) => toGame(db.prepare("SELECT * FROM games WHERE admin_key = ?").get(key)),
  /**
   * Das Spiel der Startseite: das zuletzt angelegte, gemerkt beim Anlegen. Wird es gelöscht, zeigt die
   * Startseite keins – nie ein älteres. (Alte Datenbanken ohne Eintrag: das neueste.)
   */
  currentGame(): GameRow | undefined {
    const id = store.setting("current_game");
    if (id === undefined) return toGame(db.prepare("SELECT * FROM games ORDER BY created DESC, rowid DESC LIMIT 1").get());
    return store.game(id);
  },
  /** Alle Spiele, neueste zuerst (Verwaltung). */
  allGames: () => db.prepare("SELECT * FROM games ORDER BY created DESC, rowid DESC").all().map(toGame) as GameRow[],
  /** Spiel samt allem, was dazugehört, endgültig entfernen. */
  deleteGame(id: string) {
    store.transaction(() => {
      for (const t of ["moves", "papers", "push_subs", "players"]) db.prepare(`DELETE FROM ${t} WHERE game_id = ?`).run(id);
      db.prepare("DELETE FROM games WHERE id = ?").run(id);
    });
  },
  /** Alle gespeicherten Züge eines Spiels, nach Tag und Spieler (für den Verlauf). */
  allMoves: (gameId: string) => (db.prepare("SELECT day, idx, move, locked FROM moves WHERE game_id = ? ORDER BY day, idx").all(gameId) as any[])
    .map(r => ({ day: r.day as number, idx: r.idx as number, move: JSON.parse(r.move) as Move, locked: !!r.locked })),
  /** Spiele, die noch laufen: nicht beendet, nicht abgebrochen. */
  activeGames: () => db.prepare("SELECT * FROM games WHERE json_extract(state, '$.over') = 0 AND cancelled = 0").all().map(toGame) as GameRow[],
  /** Nur laufende Spiele; ein beendetes bleibt beendet. */
  cancelGame: (id: string) => db.prepare("UPDATE games SET cancelled = 1 WHERE id = ? AND json_extract(state, '$.over') = 0").run(id),
  player: (token: string) => toPlayer(db.prepare("SELECT * FROM players WHERE token = ?").get(token)),
  players: (gameId: string) => db.prepare("SELECT * FROM players WHERE game_id = ? ORDER BY idx").all(gameId).map(toPlayer) as PlayerRow[],
  /** Liest nur die Abbruch-Markierung, z. B. während einer laufenden Auflösung. true auch, wenn es das Spiel nicht mehr gibt (inzwischen gelöscht). */
  isCancelled: (id: string) => { const r = db.prepare("SELECT cancelled FROM games WHERE id = ?").get(id) as { cancelled: number } | undefined; return !r || !!r.cancelled; },
  saveState(gameId: string, state: GameState, resolvedOn: string) {
    db.prepare("UPDATE games SET state = ?, last_resolved = ? WHERE id = ?").run(JSON.stringify(state), resolvedOn, gameId);
  },
  setReminded: (gameId: string, date: string) => db.prepare("UPDATE games SET last_reminded = ? WHERE id = ?").run(date, gameId),
  setBots: (gameId: string, on: boolean) => db.prepare("UPDATE games SET bots = ? WHERE id = ?").run(on ? 1 : 0, gameId),
  passwordHash: (gameId: string, idx: number) =>
    (db.prepare("SELECT pw_hash FROM players WHERE game_id = ? AND idx = ?").get(gameId, idx) as { pw_hash: string | null } | undefined)?.pw_hash ?? null,
  setPasswordHash: (gameId: string, idx: number, hash: string) => db.prepare("UPDATE players SET pw_hash = ? WHERE game_id = ? AND idx = ?").run(hash, gameId, idx),
  setPlayerToken: (gameId: string, idx: number, token: string) => db.prepare("UPDATE players SET token = ? WHERE game_id = ? AND idx = ?").run(token, gameId, idx),
  renamePlayer: (gameId: string, idx: number, name: string) => db.prepare("UPDATE players SET name = ? WHERE game_id = ? AND idx = ?").run(name, gameId, idx),
  moves(gameId: string, day: number): (SavedMove | null)[] {
    const rows = db.prepare("SELECT idx, move, locked FROM moves WHERE game_id = ? AND day = ?").all(gameId, day) as { idx: number; move: string; locked: number }[];
    return [0, 1, 2, 3].map(i => { const r = rows.find(x => x.idx === i); return r ? { move: JSON.parse(r.move), locked: !!r.locked } : null; });
  },
  saveMove(gameId: string, day: number, idx: number, move: Move, locked: boolean) {
    db.prepare("INSERT OR REPLACE INTO moves (game_id, day, idx, move, locked) VALUES (?, ?, ?, ?, ?)").run(gameId, day, idx, JSON.stringify(move), locked ? 1 : 0);
  },
  papers: (gameId: string) => db.prepare("SELECT day, text FROM papers WHERE game_id = ? ORDER BY day DESC").all(gameId) as { day: number; text: string }[],
  savePaper: (gameId: string, day: number, text: string) => db.prepare("INSERT OR REPLACE INTO papers (game_id, day, text) VALUES (?, ?, ?)").run(gameId, day, text),
  // ---- Push-Abos ----
  savePushSub: (p: PushSub) => db.prepare("INSERT OR REPLACE INTO push_subs (endpoint, game_id, idx, p256dh, auth, created) VALUES (?, ?, ?, ?, ?, ?)")
    .run(p.endpoint, p.gameId, p.idx, p.p256dh, p.auth, Date.now()),
  deletePushSub: (endpoint: string) => db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(endpoint),
  deletePushSubsOf: (gameId: string, idx: number) => db.prepare("DELETE FROM push_subs WHERE game_id = ? AND idx = ?").run(gameId, idx),
  pushSubs: (gameId: string) => (db.prepare("SELECT * FROM push_subs WHERE game_id = ?").all(gameId) as any[])
    .map(r => ({ endpoint: r.endpoint, gameId: r.game_id, idx: r.idx, p256dh: r.p256dh, auth: r.auth }) as PushSub),
  // ---- Anmeldung der Spielleitung (nur Hash des Cookie-Werts) ----
  addAdminSession: (hash: string, expires: number, secretFp: string) => {
    db.prepare("DELETE FROM admin_sessions WHERE expires < ? OR secret_fp IS NOT ?").run(Date.now(), secretFp);
    db.prepare("INSERT INTO admin_sessions (token_hash, expires, secret_fp) VALUES (?, ?, ?)").run(hash, expires, secretFp);
  },
  /** Gültig nur, solange nicht abgelaufen und das Admin-Passwort dasselbe ist wie bei der Anmeldung. */
  adminSessionValid: (hash: string, secretFp: string) =>
    !!db.prepare("SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires > ? AND secret_fp = ?").get(hash, Date.now(), secretFp),
  deleteAdminSession: (hash: string) => db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hash),
  // ---- Server-Einstellungen (z. B. VAPID-Schlüssel) ----
  setting: (key: string) => (db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined)?.value,
  setSetting: (key: string, value: string) => db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value),
};
