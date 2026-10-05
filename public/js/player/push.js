// Benachrichtigungen: Status erkennen, abonnieren, Hinweis für iPhones außerhalb des Home-Bildschirms.
import { T, api } from "../util.js";

const C = T.client;
const DISMISS = "fvz-push-dismissed";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const dismissed = () => { try { return localStorage.getItem(DISMISS) === "1"; } catch { return false; } };

/** "on" | "off" | "denied" | "iosInstall" | "unsupported" | "hidden" */
export async function pushState() {
  if (dismissed()) return "hidden";
  if (isIos() && !isStandalone()) return "iosInstall";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

const toKey = b64 => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4)), c => c.charCodeAt(0));

/** Muss aus einem Tipp heraus aufgerufen werden (Browser verlangen das für die Erlaubnis). */
export async function enablePush(playerKey, vapidKey) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(vapidKey) });
  const { result } = await api(`/api/p/${playerKey}/push`, sub.toJSON());
  return result === "failed" ? "failed" : "on";
}

/**
 * Hat der Browser schon ein Abo, dem Server still noch einmal melden. Nach „Passwort erneuern“ hat der Server
 * es gelöscht; ohne Abgleich bekäme der Spieler auf demselben Gerät keine Nachrichten mehr und merkte es nicht.
 * Ein ausgesperrtes Gerät kommt hier nicht durch, weil sein alter Link nicht mehr gilt.
 */
export async function syncPush(playerKey) {
  if (!supported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) await api(`/api/p/${playerKey}/push`, { ...sub.toJSON(), silent: true });
}

export function dismissPush() { try { localStorage.setItem(DISMISS, "1"); } catch { /* privates Fenster */ } }

/** Kleine Karte über den Reitern. Leer, wenn nichts zu tun ist. */
export function pushCard(state) {
  const close = `<button class="link" id="push-dismiss" aria-label="${C.pushDismiss}">×</button>`;
  if (state === "off") return `<div class="pushcard"><span>${C.pushOffer}</span><button class="btn" id="push-enable">${C.pushEnable}</button>${close}</div>`;
  if (state === "iosInstall") return `<div class="pushcard"><span>${C.pushIos}</span>${close}</div>`;
  if (state === "failed") return `<div class="pushcard"><span>${C.pushFailed}</span>${close}</div>`;
  if (state === "denied") return `<div class="pushcard"><span>${C.pushDenied}</span>${close}</div>`;
  return "";
}
