// Startseite: Rolle wählen, Passwort eingeben, weiter zur eigenen Seite. Ohne Spiel: neues Spiel anlegen.
import { $, T, esc, fmt, api } from "./util.js";
import { nation } from "./names.js";

const C = T.client;
const KEY = "fvz.login";
const ui = { lobby: null, who: null, mode: "login", error: "" };

// Dieses Gerät merkt sich die letzte Anmeldung (nur den eigenen Link). Ohne Speicher geht es auch.
const remembered = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const remember = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

function roleOption(value, name, detail) {
  return `<label class="opt"><input type="radio" name="who" value="${value}" ${String(ui.who) === String(value) ? "checked" : ""}>
    <span><span class="n">${name}</span>${detail ? `<br><span class="d">${detail}</span>` : ""}</span></label>`;
}

function loginView(g) {
  const last = remembered();
  if (last && last.gameId === g.id) {
    return `<p class="hint">${fmt(C.welcomeBack, { label: esc(last.label) })}</p>
      <a class="btn" href="${esc(last.url)}">${C.continue}</a>
      <p><button class="link" id="switch">${C.otherRole}</button></p>`;
  }
  const status = g.over ? C.gameOver : fmt(C.dayOf, { day: g.day, days: g.days });
  return `<p class="hint">${C.whoAreYou} · ${status}</p>
    <form id="login">
      <div class="opts">${g.players.map(p => roleOption(p.idx, nation(p.nation),
        [p.name !== nation(p.nation) && esc(p.name), !p.hasPassword && C.noPasswordYet].filter(Boolean).join(" · "))).join("")}
        ${roleOption("admin", C.adminTitle, "")}</div>
      <label class="field">${ui.who === "admin" ? C.adminSecret : C.password}
        <input type="password" id="password" autocomplete="current-password" autocapitalize="none" spellcheck="false"></label>
      <button class="btn" type="submit">${C.signIn}</button>
    </form>
    <p class="hint">${C.passwordHint}</p>
    <p><button class="link" id="new">${C.newGame}</button></p>`;
}

function createView(g) {
  return `<p class="hint">${C.startHint}</p>
    ${g && !g.over ? `<p class="hint">${C.replaceWarning}</p>` : ""}
    <form id="create">
      <label class="field">${C.adminSecret}<input type="password" id="secret" autocomplete="current-password"></label>
      ${Object.keys(T.nations).map((n, i) => `<label class="field">${fmt(C.playerFor, { nation: T.nations[n].name })}<input type="text" id="n${i}"></label>`).join("")}
      <button class="btn" type="submit">${C.create}</button>
    </form>
    ${g ? `<p><button class="link" id="back">${C.back}</button></p>` : ""}`;
}

function render() {
  const g = ui.lobby.game;
  $("#app").innerHTML = `<header class="who"><h1>${C.title}</h1></header>
    ${ui.error ? `<div class="err" role="alert">${esc(ui.error)}</div>` : ""}
    ${g && ui.mode === "login" ? loginView(g) : createView(g)}`;
  bind(g);
}

function bind(g) {
  const go = patch => { Object.assign(ui, { error: "" }, patch); render(); };
  $("#switch")?.addEventListener("click", () => { remember(null); go({}); });
  $("#new")?.addEventListener("click", () => go({ mode: "new" }));
  $("#back")?.addEventListener("click", () => go({ mode: "login" }));
  document.querySelectorAll("input[name=who]").forEach(el => el.addEventListener("change", () => {
    ui.who = el.value === "admin" ? "admin" : Number(el.value);
    const label = $("#password").closest("label").firstChild; // nur die Beschriftung tauschen, Eingabe bleibt
    label.textContent = ui.who === "admin" ? C.adminSecret : C.password;
    $("#password").focus();
  }));
  $("#login")?.addEventListener("submit", async e => {
    e.preventDefault();
    if (ui.who === null) return go({ error: C.pickRole });
    try {
      const r = await api("/api/login", { who: ui.who, password: $("#password").value });
      const label = ui.who === "admin" ? C.adminTitle : nation(g.players[ui.who].nation);
      remember({ gameId: g.id, url: r.url, label });
      location.href = r.url;
    } catch (err) { go({ error: err.message }); }
  });
  $("#create")?.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const r = await api("/api/new", { secret: $("#secret").value, names: [0, 1, 2, 3].map(i => $(`#n${i}`).value.trim()) });
      remember(null);
      location.href = r.adminUrl;
    } catch (err) { go({ error: err.message }); }
  });
}

export async function startStart() {
  ui.lobby = await api("/api/lobby");
  render();
}
