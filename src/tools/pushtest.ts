// Push-Prüfungen: node --test src/tools/pushtest.ts
// 1) Verschlüsselung exakt wie im Beispiel aus RFC 8291.  2) Kompletter Versand an einen lokalen Schein-Push-Dienst,
// der die Nachricht wie ein Browser entschlüsselt und die VAPID-Signatur prüft.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createDecipheriv, createECDH, createHmac, createPublicKey, verify } from "node:crypto";
import { b64u, encrypt, generateVapidKeys, unb64u } from "../integrations/push/crypto.ts";
import { sendPush } from "../integrations/push/send.ts";

test("Verschlüsselung entspricht RFC 8291, Anhang A", () => {
  const out = encrypt(unb64u("V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24"),
    unb64u("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4"),
    unb64u("BTBZMqHH6r4Tts7J_aSIgg"),
    { asPrivate: unb64u("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"), salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw") });
  assert.equal(b64u(out), "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
});

/** Entschlüsseln wie ein Browser (Gegenrichtung zu encrypt). */
function decrypt(body: Buffer, ua: ReturnType<typeof createECDH>, auth: Buffer): string {
  const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), data = body.subarray(21 + idlen);
  const h = (k: Buffer, d: Buffer) => createHmac("sha256", k).update(d).digest();
  const ikm = h(h(auth, ua.computeSecret(asPublic)), Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = h(salt, ikm);
  const d = createDecipheriv("aes-128-gcm", h(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16), h(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12));
  d.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
  assert.equal(plain.at(-1), 2, "Trennzeichen am Ende");
  return plain.subarray(0, -1).toString();
}

test("Versand: Schein-Push-Dienst entschlüsselt die Nachricht und prüft die Signatur", async () => {
  const ua = createECDH("prime256v1"); ua.generateKeys();
  const auth = Buffer.from("0123456789abcdef");
  const keys = generateVapidKeys();
  let got: { headers: any; body: Buffer } | null = null;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", c => chunks.push(c)).on("end", () => { got = { headers: req.headers, body: Buffer.concat(chunks) }; res.writeHead(201).end(); });
  }).listen(0);
  const port = (server.address() as any).port;
  try {
    const msg = { title: "Test", body: "Tag 2: Die neue Ausgabe ist da.", url: "https://example.org/p/abc" };
    const result = await sendPush({ endpoint: `http://127.0.0.1:${port}/push/xyz`, p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) }, msg, keys);
    assert.equal(result, "sent");
    assert.equal(got!.headers["content-encoding"], "aes128gcm");
    assert.deepEqual(JSON.parse(decrypt(got!.body, ua, auth)), msg);
    // VAPID: Token mit dem öffentlichen Schlüssel prüfen
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(got!.headers.authorization)!;
    assert.equal(m[4], keys.publicKey);
    const pub = createPublicKey({ key: { kty: "EC", crv: "P-256", x: keys.privateJwk.x, y: keys.privateJwk.y }, format: "jwk" });
    assert.ok(verify("sha256", Buffer.from(`${m[1]}.${m[2]}`), { key: pub, dsaEncoding: "ieee-p1363" }, unb64u(m[3])));
    const claims = JSON.parse(unb64u(m[2]).toString());
    assert.equal(claims.aud, `http://127.0.0.1:${port}`);
    assert.ok(claims.exp > Date.now() / 1000);
  } finally { server.close(); }
});

test("Abgelaufenes Abo wird als 'gone' erkannt", async () => {
  const ua = createECDH("prime256v1"); ua.generateKeys();
  const server = createServer((_req, res) => res.writeHead(410).end()).listen(0);
  try {
    const r = await sendPush({ endpoint: `http://127.0.0.1:${(server.address() as any).port}/x`, p256dh: b64u(ua.getPublicKey()), auth: b64u(Buffer.alloc(16, 1)) },
      { title: "t", body: "b", url: "u" }, generateVapidKeys());
    assert.equal(r, "gone");
  } finally { server.close(); }
});
