// KI-Anbindung gegen einen nachgebauten Anbieter auf localhost: node --test src/tools/aitest.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// Nachgebauter OpenAI-kompatibler Anbieter: Antwort je nach Modellname
const seen: any[] = [];
const server = createServer((req, res) => {
  let body = ""; req.on("data", c => body += c);
  req.on("end", () => {
    const b = JSON.parse(body); seen.push({ path: req.url, auth: req.headers.authorization, body: b });
    const reply = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (b.model === "kaputt") return reply(429, [{ error: { code: 429, message: "Resource exhausted" } }]); // Gemini-Stil
    if (b.model === "leer") return reply(200, { choices: [{ message: { content: "" }, finish_reason: "length" }] });
    reply(200, { choices: [{ message: { content: "  WELT AM ABGRUND  " } }] });
  });
});
await new Promise<void>(ok => server.listen(0, "127.0.0.1", ok));
const port = (server.address() as AddressInfo).port;

process.env.AI_BASE_URL = `http://127.0.0.1:${port}/v1/`;
process.env.AI_API_KEY = "geheim";
process.env.AI_MODEL = "test-modell";
process.env.AI_PROVIDER = "";
process.env.MISTRAL_API_KEY = "";
const { askAi, testAi, aiConfigured } = await import("../integrations/ai.ts");
const { resolveAiConfig } = await import("../config.ts");

test.after(() => server.close());

test("Anfrage: richtiger Pfad, Schlüssel, Modell; Antwort ohne Leerraum", async () => {
  assert.ok(aiConfigured());
  assert.equal(await askAi("Hallo", 100), "WELT AM ABGRUND");
  const last = seen.at(-1);
  assert.equal(last.path, "/v1/chat/completions");
  assert.equal(last.auth, "Bearer geheim");
  assert.equal(last.body.model, "test-modell");
  assert.equal(last.body.max_tokens, 100);
  assert.deepEqual(last.body.messages, [{ role: "user", content: "Hallo" }]);
});

test("Fehler und leere Antworten werden lesbar gemeldet", async () => {
  const base = { baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "", provider: "testanbieter" };
  await assert.rejects(askAi("x", 10, { ...base, model: "kaputt" }), /testanbieter 429: Resource exhausted/);
  await assert.rejects(askAi("x", 10, { ...base, model: "leer" }), /leere Antwort \(length\)/);
  await askAi("x", 10, { ...base, model: "ok" });
  assert.equal(seen.at(-1).auth, undefined, "ohne Schlüssel kein Authorization-Header");
});

test("Verbindungstest liefert eine Probe", async () => {
  const r = await testAi();
  assert.deepEqual(r, { ok: true, sample: "WELT AM ABGRUND" });
});

test("Einstellungen: Voreinstellungen, alte Mistral-.env, Lücken", () => {
  const g = resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "k" });
  assert.equal(g.baseUrl, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(g.model, "gemini-flash-latest");
  assert.equal(g.problem, null);

  const legacy = resolveAiConfig({ MISTRAL_API_KEY: "m", MISTRAL_MODEL: "mistral-large-latest" });
  assert.equal(legacy.provider, "mistral");
  assert.equal(legacy.baseUrl, "https://api.mistral.ai/v1");
  assert.equal(legacy.model, "mistral-large-latest");
  assert.equal(legacy.apiKey, "m");
  assert.equal(legacy.problem, null);

  assert.equal(resolveAiConfig({}).problem, "none");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini" }).problem, "noKey");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gibtsnicht", AI_API_KEY: "k" }).problem, "unknownProvider");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "openrouter", AI_API_KEY: "k" }).problem, "noModel");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "ollama", AI_MODEL: "llama3.2" }).problem, null, "Ollama braucht keinen Schlüssel");
  assert.equal(resolveAiConfig({ AI_PROVIDER: "GEMINI", AI_API_KEY: "k", AI_MODEL: "gemini-2.5-flash" }).model, "gemini-2.5-flash");
  // neue Einstellungen haben Vorrang vor alten Mistral-Werten
  assert.equal(resolveAiConfig({ AI_PROVIDER: "gemini", AI_API_KEY: "g", MISTRAL_API_KEY: "m" }).apiKey, "g");
});
