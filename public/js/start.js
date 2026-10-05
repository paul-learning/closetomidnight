// Startseite: Rolle wählen, Passwort eingeben, weiter zur eigenen Seite.
// Die Spielleitung landet in der Verwaltung (/admin); dort werden auch Spiele angelegt.
import { $, T, esc, fmt, api } from "./util.js";
import { nation } from "./names.js";

const C = T.client;
const KEY = "fvz.login";
const ui = { lobby: null, who: null, error: "" };

// Dieses Gerät merkt sich die letzte Anmeldung (Spieler: eigener Link, Spielleitung: /admin). Ohne Speicher geht es auch.
const remembered = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const remember = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
export const forgetLogin = () => remember(null);

function roleOption(value, name, detail) {
  return `<label class="opt"><input type="radio" name="who" value="${value}" ${String(ui.who) === String(value) ? "checked" : ""}>
    <span><span class="n">${name}</span>${detail ? `<br><span class="d">${detail}</span>` : ""}</span></label>`;
}

function welcomeBack(last) {
  return `<p class="hint">${fmt(C.welcomeBack, { label: esc(last.label) })}</p>
    <a class="btn" href="${esc(last.url)}">${last.admin ? C.continueAdmin : C.continue}</a>
    <p><button class="link" id="switch">${C.otherRole}</button></p>`;
}

function loginForm(g) {
  const roles = g ? g.players.map(p => roleOption(p.idx, nation(p.nation), p.hasPassword ? "" : C.noPasswordYet)).join("") : "";
  const intro = g ? `${C.whoAreYou} · ${g.over ? C.gameOver : fmt(C.dayOf, { day: g.day, days: g.days })}` : C.noGameRunning;
  return `<p class="hint">${intro}</p>
    <form id="login">
      <div class="opts">${roles}${roleOption("admin", C.adminTitle, g ? "" : C.adminLoginHint)}</div>
      <label class="field">${ui.who === "admin" ? C.adminSecret : C.password}
        <input type="password" id="password" autocomplete="current-password" autocapitalize="none" spellcheck="false"></label>
      <button class="btn" type="submit">${C.signIn}</button>
    </form>
    ${g ? `<p class="hint">${C.passwordHint}</p>` : ""}`;
}

function render() {
  const g = ui.lobby.game, last = remembered();
  if (!g && ui.who === null) ui.who = "admin"; // ohne Spiel gibt es nur die Spielleitung
  const showLast = last && (last.admin || (g && last.gameId === g.id));
  $("#app").innerHTML = `<header class="who"><h1>${C.title}</h1></header>
    ${ui.error ? `<div class="err" role="alert">${esc(ui.error)}</div>` : ""}
    ${showLast ? welcomeBack(last) : loginForm(g)}`;
  bind(g);
}

function bind(g) {
  const go = patch => { Object.assign(ui, { error: "" }, patch); render(); };
  $("#switch")?.addEventListener("click", () => { remember(null); go({}); });
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
      remember(ui.who === "admin"
        ? { admin: true, url: r.url, label: C.adminTitle }
        : { gameId: g.id, url: r.url, label: nation(g.players[ui.who].nation) });
      location.href = r.url;
    } catch (err) { go({ error: err.message }); }
  });
}

// Gilt die gemerkte Anmeldung noch? Spieler: nach „Passwort erneuern“ nicht mehr. Spielleitung: Cookie abgelaufen.
async function dropStaleLogin() {
  const last = remembered();
  if (!last) return;
  try {
    const res = await fetch(last.admin ? "/api/admin/games" : "/api" + new URL(last.url, location.href).pathname);
    if (res.status === 404 || res.status === 401) remember(null);
  } catch {} // offline o. ä.: lieber behalten
}

export async function startStart() {
  ui.lobby = await api("/api/lobby");
  await dropStaleLogin();
  render();
}
