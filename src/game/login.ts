// Startseite: wer im aktuellen Spiel mitspielt, und Anmeldung als Spieler oder Spielleitung.
// Die Anmeldung gibt nur den geheimen Link zurück; dahinter funktioniert alles wie bisher.
import { BALANCE } from "../rules/balance.ts";
import { store } from "./store.ts";
import { adminUrl, checkAdminSecret, playerUrl } from "./registration.ts";
import { generatePassword, hashPassword, verifyPassword } from "./passwords.ts";

export function lobby() {
  const g = store.latestGame();
  if (!g) return { game: null };
  return {
    game: {
      id: g.id, day: g.state.day, days: BALANCE.days, over: g.state.over,
      players: store.players(g.id).map(p => ({
        idx: p.idx, nation: g.state.players[p.idx].nation, name: p.name, hasPassword: !!store.passwordHash(g.id, p.idx),
      })),
    },
  };
}

export type LoginResult = { ok: true; url: string } | { ok: false; reason: "noGame" | "noPassword" | "wrongPassword" | "wrongSecret" | "noSecret" };

/** who: Spielernummer 0–3 oder "admin". */
export function login(who: unknown, password: unknown): LoginResult {
  const g = store.latestGame();
  if (!g) return { ok: false, reason: "noGame" };
  if (who === "admin") {
    const check = checkAdminSecret(password);
    return check === "ok" ? { ok: true, url: adminUrl(g.adminKey) } : { ok: false, reason: check };
  }
  const pl = typeof who === "number" ? store.players(g.id).find(p => p.idx === who) : undefined;
  if (!pl) return { ok: false, reason: "wrongPassword" };
  const hash = store.passwordHash(g.id, pl.idx);
  if (!hash) return { ok: false, reason: "noPassword" };
  return verifyPassword(password, hash) ? { ok: true, url: playerUrl(pl.token) } : { ok: false, reason: "wrongPassword" };
}

/** Neues Passwort für einen Spieler. Der Klartext wird nur dieses eine Mal zurückgegeben. */
export function resetPassword(gameId: string, idx: number): string | null {
  if (!store.players(gameId).some(p => p.idx === idx)) return null;
  const pw = generatePassword();
  store.setPasswordHash(gameId, idx, hashPassword(pw));
  return pw;
}
