// Anlegen von Spielen und Spieler-Links, Prüfung des Admin-Passworts.
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { CONFIG } from "../config.ts";
import { newGame } from "../engine/index.ts";
import { T } from "../i18n/index.ts";
import { store } from "./store.ts";
import { localNow } from "./time.ts";

const token = (bytes = 12) => randomBytes(bytes).toString("base64url");
const digest = (s: string) => createHash("sha256").update(s).digest();

export type SecretCheck = "ok" | "wrongSecret" | "noSecret";
export function checkAdminSecret(given: unknown): SecretCheck {
  if (!CONFIG.adminSecret) return "noSecret";
  return typeof given === "string" && timingSafeEqual(digest(given), digest(CONFIG.adminSecret)) ? "ok" : "wrongSecret";
}

export function createGame(opts: { names: string[]; bots: boolean }): { adminKey: string } {
  const id = token(8), adminKey = token(12);
  const state = newGame(randomBytes(4).readUInt32LE());
  const now = localNow();
  // Ab der Erinnerungszeit angelegt (zu wenig Zeit bis zur Auflösung): Tag 1 läuft bis morgen
  const late = now.hour >= Math.min(CONFIG.remindHour, CONFIG.resolveHour);
  store.transaction(() => {
    store.insertGame({ id, adminKey, state, bots: opts.bots, lastResolved: late ? now.date : null });
    state.players.forEach((p, idx) => store.insertPlayer({
      token: token(12), gameId: id, idx, name: (opts.names[idx] ?? "").trim().slice(0, 40) || T.nations[p.nation].name,
    }));
  });
  return { adminKey };
}

export const playerUrl = (t: string) => `${CONFIG.baseUrl}/p/${t}`;
export const adminUrl = (k: string) => `${CONFIG.baseUrl}/a/${k}`;
