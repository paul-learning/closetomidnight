// Bekannte Anbieter mit OpenAI-kompatibler Schnittstelle (POST {baseUrl}/chat/completions).
// Nur Voreinstellungen: AI_BASE_URL und AI_MODEL in der .env überschreiben sie.
export interface AiPreset {
  baseUrl: string;
  model: string;
  keyRequired: boolean;
  /** Zusätzliche Felder für die Anfrage. Lehnt das Modell sie ab (400), wird einmal ohne sie gefragt. */
  extraBody?: Record<string, unknown>;
  /** Mindestgrenze für Antwort-Token: Modelle, die erst „nachdenken“, zählen das mit. */
  minTokens?: number;
}

export const AI_PRESETS: Record<string, AiPreset> = {
  // Kostenloser Schlüssel über Google AI Studio (aistudio.google.com). Achtung: Google darf Anfragen im
  // Gratis-Kontingent zum Training nutzen – hier sind das nur Spielereignisse.
  // Feste Modellversion statt „gemini-flash-latest“: Hinter dem Alias tauscht Google das Modell ohne Ankündigung.
  // Flash-Lite statt Flash: Das neueste Flash ist im Gratis-Kontingent oft überlastet (503); für eine kurze
  // Titelseite reicht Flash-Lite. Wer mehr will: AI_MODEL=gemini-3.8-flash.
  // Gemini-3-Modelle denken immer nach; „low“ hält das klein, und die Grenze lässt genug Platz für den Text.
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.5-flash-lite", keyRequired: true,
    extraBody: { reasoning_effort: "low" }, minTokens: 8000,
  },
  mistral: { baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", keyRequired: true },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyRequired: true },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "", keyRequired: true },
  // Lokales Modell ohne Schlüssel. Im Docker-Container ist „localhost“ der Container selbst –
  // dort AI_BASE_URL auf den Rechner mit Ollama setzen (siehe README).
  ollama: { baseUrl: "http://localhost:11434/v1", model: "", keyRequired: false },
};
