// KI-Anbindung gegen einen nachgebauten Anbieter auf localhost: node --test src/tools/aitest.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Nachgebauter OpenAI-kompatibler Anbieter. `mode` steuert die nächsten Antworten.
let mode: "ok" | "429" | "empty" | "html" | "flaky" | "noExtra" | "markdown" = "ok";
const seen: any[] = [];
const server = createServer((req, res) => {
  let body = ""; req.on("data", c => body += c);
  req.on("end", () => {
    const b = JSON.parse(body); seen.push({ path: req.url, auth: req.headers.authorization, body: b });
    const reply = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (mode === "429") return reply(429, [{ error: { code: 429, message: "Resource exhausted" } }]); // Gemini-Stil
    if (mode === "empty") return reply(200, { choices: [{ message: { content: "" }, finish_reason: "length" }] });
    if (mode === "html") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>Wartung</html>"); }
    if (mode === "flaky") { mode = "ok"; return reply(503, { error: { message: "The model is overloaded" } }); }
    if (mode === "markdown") return reply(200, { choices: [{ message: { content: "**PANIK!**\n\n* Teutonien *zögert*" } }] });
    if (mode === "noExtra" && "reasoning_effort" in b) return reply(400, { error: { message: "Unknown field reasoning_effort" } });
    reply(200, { choices: [{ message: { content: "  WELT AM ABGRUND  " } }] });
  });
});
await new Promise<void>(ok => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as AddressInfo).port;

process.env.AI_BASE_URL = `http://127.0.0.1:${port}/v1/`;
process.env.AI_API_KEY = "geheim";
process.env.AI_MODEL = "test-modell";
process.env.AI_PROVIDER = "";
process.env.AI_RETRY_DELAY_MS = "5";
process.env.MISTRAL_API_KEY = "";
process.env.DB_PATH = ":memory:";
const { askAi, testAi, aiConfigured } = await import("../integrations/ai.ts");
const { CONFIG, resolveAiConfig } = await import("../config.ts");

const base = { ...CONFIG.ai, provider: "testanbieter" };
test.after(() => server.close());
test.beforeEach(() => { mode = "ok"; seen.length = 0; });

test("Anfrage: richtiger Pfad, Schlüssel, Modell; Antwort ohne Leerraum", async () => {
  assert.ok(aiConfigured());
  assert.equal(await askAi("Hallo", 100), "WELT AM ABGRUND");
  const last = seen.at(-1);
  assert.equal(last.path, "/v1/chat/completions");
  assert.equal(last.auth, "Bearer geheim");
  assert.equal(last.body.model, "test-modell");
  assert.equal(last.body.max_tokens, 100);
  assert.deepEqual(last.body.messages, [{ role: "user", content: "Hallo" }]);
  assert.ok(!("reasoning_effort" in last.body), "eigene Adresse: keine Zusatzfelder");
});

test("Fehler werden lesbar gemeldet; dauerhafte Fehler ohne zweiten Versuch", async () => {
  mode = "empty";
  await assert.rejects(askAi("x", 10, {}, base), /testanbieter: leere Antwort \(length\)/);
  assert.equal(seen.length, 1);
  mode = "html";
  await assert.rejects(askAi("x", 10, {}, base), /testanbieter 200: keine JSON-Antwort/);
  mode = "ok";
  await askAi("x", 10, {}, { ...base, apiKey: "" });
  assert.equal(seen.at(-1).auth, undefined, "ohne Schlüssel kein Authorization-Header");
});

test("vorübergehende Fehler: genau ein zweiter Versuch", async () => {
  mode = "flaky"; // erst 503, dann ok
  assert.equal(await askAi("x", 10, {}, base), "WELT AM ABGRUND");
  assert.equal(seen.length, 2);
  seen.length = 0; mode = "429"; // bleibt überlastet
  await assert.rejects(askAi("x", 10, {}, base), /testanbieter 429: Resource exhausted/);
  assert.equal(seen.length, 2, "nicht mehr als zwei Versuche");
  seen.length = 0; mode = "flaky";
  await assert.rejects(askAi("x", 10, { retry: false }, base), /503/); // Verbindungstest: sofortige Rückmeldung
  assert.equal(seen.length, 1);
});

test("Zusatzfeld und Mindestgrenze der Voreinstellung; lehnt das Modell das Feld ab, ohne", async () => {
  const withPreset = { ...base, extraBody: { reasoning_effort: "low" }, minTokens: 8000 };
  await askAi("x", 2000, {}, withPreset);
  assert.equal(seen.at(-1).body.reasoning_effort, "low");
  assert.equal(seen.at(-1).body.max_tokens, 8000);
  seen.length = 0; mode = "noExtra";
  assert.equal(await askAi("x", 2000, {}, withPreset), "WELT AM ABGRUND");
  assert.equal(seen.length, 2);
  assert.ok(!("reasoning_effort" in seen[1].body));
});

test("Verbindungstest liefert eine Probe", async () => {
  assert.deepEqual(await testAi(), { ok: true, sample: "WELT AM ABGRUND" });
});

test("fällt die KI aus, erscheint der Tag trotzdem – mit der schlichten Zusammenfassung", async () => {
  const { store } = await import("../game/store.ts");
  const { createGame } = await import("../game/registration.ts");
  const { resolveGame } = await import("../game/service.ts");
  const { plainSummary } = await import("../newspaper/summary.ts");
  for (const m of ["429", "empty", "html"] as const) {
    mode = m;
    const { adminKey } = createGame({ names: [], bots: false });
    const g = store.gameByAdminKey(adminKey)!;
    await resolveGame(g.id);
    const after = store.game(g.id)!.state;
    assert.equal(after.day, 2, `${m}: Tag aufgelöst`);
    assert.equal(store.papers(g.id)[0].text, plainSummary(after, after.history.at(-1)!), `${m}: schlichte Zusammenfassung`);
  }
  mode = "ok";
  const { adminKey } = createGame({ names: [], bots: false });
  const g = store.gameByAdminKey(adminKey)!;
  await resolveGame(g.id);
  assert.equal(store.papers(g.id)[0].text, "🗞 WELT AM ABGRUND", "mit KI: Text der KI");
});

test("Markdown aus der KI landet als reiner Text in der Zeitung und im Verbindungstest", async () => {
  const { store } = await import("../game/store.ts");
  const { createGame } = await import("../game/registration.ts");
  const { resolveGame } = await import("../game/service.ts");
  mode = "markdown";
  const { adminKey } = createGame({ names: [], bots: false });
  const g = store.gameByAdminKey(adminKey)!;
  await resolveGame(g.id);
  assert.equal(store.papers(g.id)[0].text, "🗞 PANIK!\n\n• Teutonien zögert");
  assert.deepEqual(await testAi(), { ok: true, sample: "PANIK!\n\n• Teutonien zögert" });
});

test("Einstellungen: Voreinstellungen", () => {
  const g = resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "k" });
  assert.equal(g.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(g.model, "gemini-3.5-flash-lite");
  assert.deepEqual(g.extraBody, { reasoning_effort: "low" });
  assert.equal(g.problem, null);
  assert.equal(resolveAiConfig({ AI_PROVIDER: "GEMINI", AI_API_KEY: "k", AI_MODEL: "gemini-3.5-flash-lite" }).model, "gemini-3.5-flash-lite");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "ollama", AI_MODEL: "llama3.2" }).problem, null, "Ollama braucht keinen Schlüssel");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "k", AI_BASE_URL: "http://x/v1" }).extraBody, undefined, "eigene Adresse: keine Zusatzfelder");
});

test("Einstellungen: alte Mistral-.env und Mischungen", () => {
  const legacy = resolveAiConfig({ MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-large-latest" });
  assert.deepEqual([legacy.provider, legacy.baseUrl, legacy.model, legacy.apiKey, legacy.problem],
    ["mistral", "https://api.mistral.ai/v1", "mistral-large-latest", "m", null]);
  // AI_PROVIDER=mistral nimmt die alten Werte mit
  const explicit = resolveAiConfig({ AI_PROVIDER: "mistral", MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-large-latest" });
  assert.deepEqual([explicit.apiKey, explicit.model, explicit.problem], ["m", "mistral-large-latest", null]);
  // Neuer Schlüssel ohne Anbieter: nie an Mistral schicken, sondern melden
  const mixed = resolveAiConfig({ AI_API_KEY: "google-key", MISTRAL_API_KEY: "m" });
  assert.equal(mixed.problem, "noProvider");
  assert.notEqual(mixed.baseUrl, "https://api.mistral.ai/v1");
  // Anderer Anbieter: alte Mistral-Werte bleiben außen vor
  const gemini = resolveAiConfig({ AI_PROVIDER: "gemini", MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-large-latest" });
  assert.deepEqual([gemini.apiKey, gemini.model, gemini.problem], ["", "gemini-3.5-flash-lite", "noKey"]);
});

test("Einstellungen: Lücken werden einzeln benannt", () => {
  assert.equal(resolveAiConfig({}).problem, "none");
  assert.equal(resolveAiConfig({ AI_API_KEY: "k" }).problem, "noProvider");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gibtsnicht", AI_API_KEY: "k" }).problem, "unknownProvider");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "openrouter", AI_API_KEY: "k" }).problem, "noModel");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini" }).problem, "noKey");
  assert.equal(resolveAiConfig({ AI_BASE_URL: "http://host:1/v1//", AI_MODEL: "m" }).baseUrl, "http://host:1/v1");
  assert.doesNotThrow(() => resolveAiConfig({ AI_BASE_URL: "kein-url", AI_MODEL: "m" }), "kaputte Adresse bricht den Start nicht ab");
});
