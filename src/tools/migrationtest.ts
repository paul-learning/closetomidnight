// Alte Datenbanken müssen mit dem aktuellen Code starten: node --test src/tools/migrationtest.ts
// Legt Datenbanken im Stand früherer Versionen an und startet den Speicher in einem eigenen Prozess darauf.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const STORE = new URL("../game/store.ts", import.meta.url).pathname;
const SESSION = new URL("../game/adminSession.ts", import.meta.url).pathname;

/** Startet den aktuellen Speicher auf der Datenbank und meldet sich einmal als Spielleitung an. */
function openWithCurrentCode(dbPath: string) {
  const script = `const { store } = await import(${JSON.stringify(STORE)});
    const { startAdminSession, isAdminSession } = await import(${JSON.stringify(SESSION)});
    const t = startAdminSession(); if (!isAdminSession(t)) throw new Error("Anmeldung ungültig");
    store.allGames(); store.currentGame();`;
  execFileSync(process.execPath, ["--no-warnings", "--input-type=module", "-e", script], {
    env: { ...process.env, DB_PATH: dbPath, ADMIN_SECRET: "test" }, stdio: "pipe",
  });
}

const OLD_SCHEMAS: Record<string, string> = {
  // erste Fassung mit Telegram-Spalte
  "mit chat_id": `CREATE TABLE games (id TEXT PRIMARY KEY, admin_key TEXT UNIQUE, state TEXT, chat_id TEXT, bots INTEGER DEFAULT 0, last_resolved TEXT, last_reminded TEXT, created INTEGER);
    CREATE TABLE players (token TEXT PRIMARY KEY, game_id TEXT, idx INTEGER, name TEXT);`,
  // vor Passwörtern und Abbrechen
  "ohne pw_hash und cancelled": `CREATE TABLE games (id TEXT PRIMARY KEY, admin_key TEXT UNIQUE, state TEXT, bots INTEGER DEFAULT 0, last_resolved TEXT, last_reminded TEXT, created INTEGER);
    CREATE TABLE players (token TEXT PRIMARY KEY, game_id TEXT, idx INTEGER, name TEXT);`,
  // erster Stand der Verwaltung: Anmeldungen ohne Passwort-Fingerabdruck
  "admin_sessions ohne secret_fp": `CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, expires INTEGER);
    INSERT INTO admin_sessions VALUES ('alt', ${Date.now() + 86_400_000});`,
};

for (const [name, sql] of Object.entries(OLD_SCHEMAS)) {
  test(`alte Datenbank startet: ${name}`, () => {
    const dir = mkdtempSync(join(tmpdir(), "fvz-mig-"));
    try {
      const path = join(dir, "fvz.sqlite");
      new DatabaseSync(path).exec(sql);
      assert.doesNotThrow(() => openWithCurrentCode(path));
      if (name.startsWith("admin_sessions")) {
        const row = new DatabaseSync(path).prepare("SELECT secret_fp FROM admin_sessions WHERE token_hash = 'alt'").get();
        assert.equal(row, undefined, "alte Anmeldung ohne Fingerabdruck wird beim nächsten Anmelden entfernt");
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
