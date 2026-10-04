// Versand an Push-Dienste (Google, Apple, Mozilla …). Abgelaufene Abos meldet der Dienst mit 404/410.
import { CONFIG } from "../../config.ts";
import { encrypt, generateVapidKeys, unb64u, vapidHeader } from "./crypto.ts";
import type { VapidKeys } from "./crypto.ts";

export interface Subscription { endpoint: string; p256dh: string; auth: string }
export interface PushMessage { title: string; body: string; url: string }
export type PushResult = "sent" | "gone" | "failed";

/** Schlüssel laden oder beim ersten Mal erzeugen und über `save` dauerhaft ablegen. */
export function loadVapidKeys(load: () => string | undefined, save: (json: string) => void): VapidKeys {
  const existing = load();
  if (existing) return JSON.parse(existing);
  const keys = generateVapidKeys();
  save(JSON.stringify(keys));
  return keys;
}

const contact = () => CONFIG.pushContact || (CONFIG.baseUrl.startsWith("https://") ? CONFIG.baseUrl : "mailto:spielleitung@localhost");

export async function sendPush(sub: Subscription, msg: PushMessage, keys: VapidKeys): Promise<PushResult> {
  try {
    const body = encrypt(Buffer.from(JSON.stringify(msg)), unb64u(sub.p256dh), unb64u(sub.auth));
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal",
        Authorization: vapidHeader(sub.endpoint, keys, contact()) },
      body: new Uint8Array(body), signal: AbortSignal.timeout(15000),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) { console.error("Push-Dienst antwortet", res.status, await res.text().catch(() => "")); return "failed"; }
    return "sent";
  } catch (e) {
    console.error("Push fehlgeschlagen:", e);
    return "failed";
  }
}
