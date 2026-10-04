// Spielerseite: Zustand, Darstellung und Speichern. Inhalte der Schritte und Reiter stehen in player/.
import { $, $$, T, esc, fmt, api } from "./util.js";
import { STEPS, stepsFor } from "./player/steps.js";
import { allianceTab, header, paperTab, resultTab } from "./player/tabs.js";
import { renderIntro, seenIntro } from "./player/intro.js";
import { dismissPush, enablePush, pushCard, pushState } from "./player/push.js";

const C = T.client;
const ui = { data: null, draft: null, error: "", tab: "zug", step: 0, intro: -1, key: "", push: "hidden" };

function moveTab(d, locked) {
  if (locked) return `<h2>${C.lockedTitle}</h2><p class="hint">${fmt(C.lockedHint, { hour: d.rules.resolveHour })}</p>${STEPS.uebersicht(d, ui.draft, "disabled")}`;
  const steps = stepsFor(d);
  return `<ol class="stepper" aria-label="${C.stepsLabel}">${steps.map((s, i) => `<li class="${i === ui.step ? "now" : i < ui.step ? "done" : ""}">
      <button data-step="${i}" aria-label="${C.steps[s]}" aria-current="${i === ui.step ? "step" : "false"}"></button></li>`).join("")}</ol>
    <h2>${C.steps[steps[ui.step]]}</h2>${STEPS[steps[ui.step]](d, ui.draft, "")}`;
}

function bar(d, locked) {
  const el = $("#bar");
  if (d.over || ui.tab !== "zug") { el.hidden = true; return; }
  const steps = stepsFor(d), last = ui.step === steps.length - 1;
  el.hidden = false;
  el.innerHTML = locked
    ? `<div class="inner"><span class="status">${C.locked}</span><button class="btn ghost" id="edit">${C.edit}</button></div>`
    : `<div class="inner"><button class="btn ghost" id="back" ${ui.step === 0 ? "disabled" : ""}>${C.back}</button>
       <span class="status">${fmt(C.stepOf, { n: ui.step + 1, total: steps.length })}</span>
       ${last ? `<button class="btn" id="lock">${C.lock}</button>` : `<button class="btn" id="next">${C.next}</button>`}</div>`;
}


function render() {
  const d = ui.data;
  if (ui.intro >= 0) return renderIntro(ui.intro, d.rules, p => { ui.intro = p; render(); }, () => { ui.intro = -1; render(); });
  const locked = d.myMove?.locked && !ui.draft._editing;
  ui.step = Math.min(ui.step, stepsFor(d).length - 1);
  const body = ui.tab === "zeitung" ? paperTab(d) : ui.tab === "allianz" ? allianceTab(d) : d.over ? resultTab(d) : moveTab(d, locked);
  $("#app").innerHTML = header(d, ui.tab) + pushCard(ui.push) + (ui.error ? `<div class="err" role="alert">${esc(ui.error)}</div>` : "") + body;
  bar(d, locked);
  bind(d, locked);
}

function bind(d, locked) {
  const go = i => { ui.step = i; render(); window.scrollTo({ top: $(".tabs").offsetTop - 8 }); };
  $("#back")?.addEventListener("click", () => go(ui.step - 1));
  $("#next")?.addEventListener("click", () => go(ui.step + 1));
  $("#lock")?.addEventListener("click", () => save(true));
  $("#edit")?.addEventListener("click", () => { ui.draft._editing = true; ui.step = stepsFor(d).length - 1; render(); });
  $("#help").addEventListener("click", () => { ui.intro = 0; render(); });
  $("#push-enable")?.addEventListener("click", async e => {
    e.target.disabled = true; e.target.textContent = C.pushEnabling;
    try { ui.push = await enablePush(ui.key, d.pushKey); } catch { ui.push = "failed"; }
    if (ui.push === "on") ui.push = "hidden";
    render();
  });
  $("#push-dismiss")?.addEventListener("click", () => { dismissPush(); ui.push = "hidden"; render(); });
  $$("[data-step]").forEach(b => b.addEventListener("click", () => { if (locked) ui.draft._editing = true; go(Number(b.dataset.step)); }));
  $$("[data-tab]").forEach(b => b.addEventListener("click", () => { ui.tab = b.dataset.tab; render(); }));
  $$("#app input, #app select").forEach(el => el.addEventListener("change", () => {
    const n = el.name, v = el.type === "checkbox" ? el.checked : el.value;
    if (n === "vote") ui.draft.vote = v || null;
    else if (n === "card") { ui.draft.cardId = v || null; delete ui.draft.target; }
    else if (n === "target" || n === "accuse") ui.draft[n] = v === "" ? undefined : Number(v);
    else ui.draft[n] = v;
    save(false);
  }));
}


/** Interaktionskarte gewählt, aber noch kein Ziel: der Zug ist noch nicht speicherbar. */
function awaitingTarget(d, draft) {
  const card = d.me.hand.find(c => c.id === draft.cardId);
  return !!card && !!(card.steal || card.leak) && draft.target === undefined;
}

async function save(lock) {
  ui.error = "";
  if (!lock && awaitingTarget(ui.data, ui.draft)) return render();
  try {
    const { _editing, ...move } = ui.draft;
    ui.data = await api(`/api/p/${ui.key}/move`, { move, lock });
    // Entwurf an das anpassen, was der Server tatsächlich gespeichert hat (z. B. nach einem Tageswechsel)
    ui.draft = { ...(ui.data.myMove?.move ?? { vote: null, cardId: null }), _editing: lock ? false : _editing };
    if (lock) ui.step = 0;
  } catch (e) { ui.error = e.message; }
  render();
}

export async function startPlayer(key) {
  ui.key = key;
  const load = async () => {
    ui.data = await api(`/api/p/${key}`);
    ui.draft = { ...(ui.data.myMove?.move ?? { vote: null, cardId: null }) };
    render();
  };
  if (!seenIntro()) ui.intro = 0;
  ui.push = await pushState().catch(() => "hidden");
  if (ui.push === "on" || ui.push === "unsupported") ui.push = "hidden";
  await load();
  // Bei Rückkehr zur Seite neu laden (neuer Tag, andere Spieler), aber nicht mitten im Bearbeiten
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !ui.draft?._editing && ui.intro < 0) load().catch(() => {}); });
}

