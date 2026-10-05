// Wer wann benachrichtigt wird. Inhalte ohne Geheimnisse: nur Tag, Uhrzeit, Spielende, Erinnerung.
import { CONFIG } from "../config.ts";
import { clockTime } from "../engine/index.ts";
import type { GameState } from "../engine/index.ts";
import { T, fmt } from "../i18n/index.ts";
import { loadVapidKeys, sendPush } from "../integrations/push/send.ts";
import type { PushMessage, Subscription } from "../integrations/push/send.ts";
import { playerUrl } from "./registration.ts";
import { store } from "./store.ts";

const vapid = () => loadVapidKeys(() => store.setting("vapid"), json => store.setSetting("vapid", json));
export const vapidPublicKey = () => vapid().publicKey;

async function deliver(gameId: string, toIdx: (idx: number) => boolean, body: string) {
  const keys = vapid();
  const tokens = new Map(store.players(gameId).map(p => [p.idx, p.token]));
  await Promise.all(store.pushSubs(gameId).filter(s => toIdx(s.idx)).map(async s => {
    const msg: PushMessage = { title: T.push.title, body, url: playerUrl(tokens.get(s.idx)!) };
    if (await sendPush(s, msg, keys) === "gone") store.deletePushSub(s.endpoint);
  }));
}

/** Nach der Auflösung: alle Spieler. */
export function notifyNewEdition(gameId: string, s: GameState) {
  const body = s.over ? fmt(T.push.gameOver, { ending: T.endings[s.ending!] })
    : fmt(T.push.newEdition, { day: s.history.at(-1)!.day, clock: clockTime(s.tracks) });
  return deliver(gameId, () => true, body);
}

/** Erinnerung: nur wer noch nicht festgelegt hat. */
export function notifyReminder(gameId: string, notLocked: number[], hoursLeft: number) {
  return deliver(gameId, idx => notLocked.includes(idx), fmt(T.push.reminder, { hours: hoursLeft, hour: CONFIG.resolveHour }));
}

/**
 * Abo speichern und mit einer Willkommensnachricht bestätigen.
 * silent: nur abgleichen, ohne Nachricht. Die Spielerseite schickt das bei jedem Öffnen, falls der Browser
 * schon ein Abo hat, der Server aber nicht mehr (z. B. nach „Passwort erneuern“ und neuer Anmeldung).
 */
export async function subscribe(gameId: string, idx: number, sub: Subscription, opts: { silent?: boolean } = {}) {
  store.savePushSub({ ...sub, gameId, idx });
  if (opts.silent) return "saved" as const;
  const token = store.players(gameId).find(p => p.idx === idx)!.token;
  const result = await sendPush(sub, { title: T.push.title, body: T.push.welcome, url: playerUrl(token) }, vapid());
  if (result === "gone") store.deletePushSub(sub.endpoint);
  return result;
}

export const subscriberCount = (gameId: string) => new Set(store.pushSubs(gameId).map(s => s.idx)).size;
