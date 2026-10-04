// Web-Push-Verschlüsselung (RFC 8291, aes128gcm nach RFC 8188) und VAPID-Signatur (RFC 8292).
// Nur node:crypto, keine Pakete. Geprüft gegen das Beispiel aus RFC 8291 (siehe selftest).
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

export const b64u = (b: Buffer) => b.toString("base64url");
export const unb64u = (s: string) => Buffer.from(s, "base64url");
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

export interface EncryptOptions { asPrivate?: Buffer; salt?: Buffer } // nur für Tests fest vorgeben

/** Verschlüsselt eine Nachricht für ein Abo (p256dh = Schlüssel des Browsers, auth = Geheimnis des Abos). */
export function encrypt(plaintext: Buffer, uaPublic: Buffer, authSecret: Buffer, opts: EncryptOptions = {}): Buffer {
  const ecdh = createECDH("prime256v1");
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = opts.salt ?? randomBytes(16);

  const ecdhSecret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, ecdhSecret);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, body]);
}

export interface VapidKeys { publicKey: string; privateJwk: { kty: "EC"; crv: "P-256"; x: string; y: string; d: string } }

/** Neues VAPID-Schlüsselpaar. publicKey ist der rohe Schlüssel (65 Byte) als base64url, wie der Browser ihn braucht. */
export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const pub = ecdh.getPublicKey();
  return {
    publicKey: b64u(pub),
    privateJwk: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: b64u(ecdh.getPrivateKey()) },
  };
}

/** Authorization-Header für den Push-Dienst des Abos. */
export function vapidHeader(endpoint: string, keys: VapidKeys, subject: string): string {
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const part = (o: object) => b64u(Buffer.from(JSON.stringify(o)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud, exp, sub: subject })}`;
  const key = createPrivateKey({ key: keys.privateJwk, format: "jwk" });
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64u(signature)}, k=${keys.publicKey}`;
}
