// Verwaltung (/admin): alle Spiele auf einen Blick, neues Spiel anlegen, abbrechen, Verlauf exportieren, löschen.
// Zugang über das Anmelde-Cookie der Spielleitung; ohne geht es zurück zur Startseite.
import { $, $$, T, esc, fmt, api } from "../util.js";
import { nation } from "../names.js";
import { forgetLogin } from "../start.js";

const C = T.client;
let games = [], error = "", busy = false;

const dateOf = ms => new Date(ms).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
function statusText(g) {
  if (g.status === "cancelled") return fmt(C.ovCancelled, { day: g.day });
  if (g.status === "over") return fmt(C.ovOver, { ending: T.endings[g.ending] ?? "" });
  return fmt(C.ovRunning, { day: g.day, days: g.days });
}

function gameCard(g) {
  const running = g.status === "running";
  const names = g.players.map(p => p.name === nation(p.nation) ? nation(p.nation) : `${nation(p.nation)}: ${esc(p.name)}`);
  return `<div class="game">
    <div class="title">${fmt(C.ovGameOf, { date: dateOf(g.created) })}</div>
    <div class="hint">${statusText(g)}</div>
    <div class="hint">${names.join(" · ")}</div>
    <div class="actions">
      <a class="btn ghost" href="${esc(g.adminUrl)}">${C.ovOpen}</a>
      <a class="btn ghost" href="/api/admin/games/${encodeURIComponent(g.id)}/export" download>${C.ovExport}</a>
      ${running ? `<button class="btn red" data-cancel="${esc(g.id)}">${C.cancelButton}</button>`
                : `<button class="btn red" data-delete="${esc(g.id)}">${C.ovDelete}</button>`}
    </div></div>`;
}

function render() {
  const running = games.some(g => g.status === "running");
  $("#app").innerHTML = `<header class="who"><h1>${C.adminTitle}</h1><span class="meta"><button class="link" id="logout">${C.ovLogout}</button></span></header>
    ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
    <h2>${C.ovGames}</h2>
    ${games.length ? games.map(gameCard).join("") : `<p class="hint">${C.ovNoGames}</p>`}
    <h2>${C.newGame}</h2>
    ${running ? `<p class="hint">${C.replaceWarning}</p>` : ""}
    <form id="create">
      ${Object.keys(T.nations).map((n, i) => `<label class="field">${fmt(C.playerFor, { nation: T.nations[n].name })}<input type="text" id="n${i}"></label>`).join("")}
      <button class="btn" type="submit" ${busy ? "disabled" : ""}>${C.create}</button>
    </form>`;
  bind();
}

function bind() {
  $("#create").addEventListener("submit", e => {
    e.preventDefault();
    if (games.some(g => g.status === "running") && !confirm(C.ovReplaceConfirm)) return;
    act("/api/admin/games", { names: [0, 1, 2, 3].map(i => $(`#n${i}`).value.trim()) });
  });
  $$("[data-cancel]").forEach(b => b.addEventListener("click", () => { if (confirm(C.cancelConfirm)) act(`/api/admin/games/${b.dataset.cancel}/cancel`, {}); }));
  $$("[data-delete]").forEach(b => b.addEventListener("click", () => { if (confirm(C.ovDeleteConfirm)) act(`/api/admin/games/${b.dataset.delete}/delete`, {}); }));
  $("#logout").addEventListener("click", async () => {
    await api("/api/admin/logout", {}).catch(() => {});
    forgetLogin();
    location.href = "/";
  });
}

async function act(path, body) {
  error = ""; busy = true; render();
  try { games = (await api(path, body)).games; } catch (e) { error = e.message; }
  busy = false; render();
}

export async function startOverview() {
  const res = await fetch("/api/admin/games");
  if (res.status === 401) { location.href = "/"; return; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  games = data.games;
  render();
}
