// Startseite: wer im aktuellen Spiel mitspielt, und Anmeldung als Spieler oder Spielleitung.
// Die Anmeldung gibt nur den geheimen Link zurück; dahinter funktioniert alles wie bisher.
import { BALANCE } from "../rules/balance.ts";
import { store } from "./store.ts";
import { adminUrl, checkAdminSecret, playerUrl, token } from "./registration.ts";
import { generatePassword, hashPassword, verifyPassword } from "./passwords.ts";

/** Öffentlich (ohne Anmeldung): nur Nationen, Spielstand und ob ein Passwort gesetzt ist. Keine Namen, keine Links. */
export function lobby() {
  const g = store.latestGame();
  if (!g || g.cancelled) return { game: null };
  return {
    game: {
      id: g.id, day: g.state.day, days: BALANCE.days, over: g.state.over,
      players: store.players(g.id).map(p => ({ idx: p.idx, nation: g.state.players[p.idx].nation, hasPassword: !!p.hasPassword })),
    },
  };
}

export type LoginResult = { ok: true; url: string } | { ok: false; reason: "noGame" | "noPassword" | "wrongPassword" | "wrongSecret" | "noSecret" };

/** who: Spielernummer 0–3 oder "admin". */
export async function login(who: unknown, password: unknown): Promise<LoginResult> {
  const g = store.latestGame();
  if (!g || g.cancelled) return { ok: false, reason: "noGame" };
  if (who === "admin") {
    const check = checkAdminSecret(password);
    return check === "ok" ? { ok: true, url: adminUrl(g.adminKey) } : { ok: false, reason: check };
  }
  const pl = typeof who === "number" ? store.players(g.id).find(p => p.idx === who) : undefined;
  if (!pl) return { ok: false, reason: "wrongPassword" };
  if (!pl.hasPassword) return { ok: false, reason: "noPassword" };
  return await verifyPassword(password, store.passwordHash(g.id, pl.idx)) ? { ok: true, url: playerUrl(pl.token) } : { ok: false, reason: "wrongPassword" };
}

/**
 * Neues Passwort für einen Spieler. Der Klartext wird nur dieses eine Mal zurückgegeben.
 * Hatte er schon eins, ist das ein Aussperren: Dann gibt es auch einen neuen Link (alte Links und
 * angemeldete Geräte gelten nicht mehr), und seine Push-Abos werden gelöscht, weil Benachrichtigungen
 * sonst den neuen Link an das alte Gerät schicken würden. Beim ersten Passwort bleibt der Link, damit
 * schon verschickte Links weiter funktionieren.
 */
export function resetPassword(gameId: string, idx: number): string | null {
  const pl = store.players(gameId).find(p => p.idx === idx);
  if (!pl) return null;
  const pw = generatePassword(), hash = hashPassword(pw);
  store.transaction(() => {
    store.setPasswordHash(gameId, idx, hash);
    if (pl.hasPassword) { store.setPlayerToken(gameId, idx, token(12)); store.deletePushSubsOf(gameId, idx); }
  });
  return pw;
}
