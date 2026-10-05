// Bekannte Anbieter mit OpenAI-kompatibler Schnittstelle (POST {baseUrl}/chat/completions).
// Nur Voreinstellungen: AI_BASE_URL und AI_MODEL in der .env überschreiben sie.
export interface AiPreset { baseUrl: string; model: string; keyRequired: boolean }

export const AI_PRESETS: Record<string, AiPreset> = {
  // Kostenloser Schlüssel über Google AI Studio (aistudio.google.com). Achtung: Google darf Anfragen im
  // Gratis-Kontingent zum Training nutzen – hier sind das nur Spielereignisse.
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-flash-latest", keyRequired: true },
  mistral: { baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", keyRequired: true },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyRequired: true },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "", keyRequired: true },
  // Lokales Modell auf dem Server, ohne Schlüssel
  ollama: { baseUrl: "http://localhost:11434/v1", model: "", keyRequired: false },
};
