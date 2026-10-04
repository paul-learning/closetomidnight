// Startseite: neues Spiel anlegen (nur mit Admin-Passwort).
import { $, T, esc, fmt, api } from "./util.js";

const C = T.client;

export function startStart(error = "") {
  $("#app").innerHTML = `<header class="who"><h1>${C.title}</h1></header>
    <p class="hint">${C.startHint}</p>
    ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
    <label class="field">${C.adminSecret}<input type="password" id="secret"></label>
    ${Object.keys(T.nations).map((n, i) => `<label class="field">${fmt(C.playerFor, { nation: T.nations[n].name })}<input type="text" id="n${i}"></label>`).join("")}
    <button class="btn" id="create">${C.create}</button>`;
  $("#create").addEventListener("click", async () => {
    try {
      const r = await api("/api/new", { secret: $("#secret").value, names: [0, 1, 2, 3].map(i => $(`#n${i}`).value.trim()) });
      location.href = r.adminUrl;
    } catch (e) { startStart(e.message); }
  });
}
