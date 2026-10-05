// Kleine Helfer: DOM, Escaping, Texte, Server-Aufrufe.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const T = window.T;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Ersetzt {platzhalter}. Werte von Nutzern vorher mit esc() schützen. */
export const fmt = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));

export async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status });
  return data;
}
