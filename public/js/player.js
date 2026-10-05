// Spielerseite: Zustand, Darstellung und Speichern. Inhalte der Schritte und Reiter stehen in player/.
import { $, $$, T, esc, fmt, api } from "./util.js";
import { STEPS, stepsFor } from "./player/steps.js";
import { allianceTab, header, incomingBox, paperTab, resultTab } from "./player/tabs.js";
import { renderIntro, seenIntro } from "./player/intro.js";
import { dismissPush, enablePush, pushCard, pushState, syncPush } from "./player/push.js";

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
  if (d.over || d.cancelled || ui.tab !== "zug") { el.hidden = true; return; }
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
  const body = ui.tab === "zeitung" || (d.cancelled && ui.tab === "zug") ? paperTab(d) : ui.tab === "allianz" ? allianceTab(d)
    : incomingBox(d) + (d.over ? resultTab(d) : moveTab(d, locked));
  const notice = d.cancelled ? `<div class="err" role="status">${C.cancelledPlayer} <a class="link" href="/">${C.toStart}</a></div>` : "";
  $("#app").innerHTML = header(d, ui.tab) + notice + (d.cancelled ? "" : pushCard(ui.push)) + (ui.error ? `<div class="err" role="alert">${esc(ui.error)}</div>` : "") + body;
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

// Immer nur ein Speichervorgang gleichzeitig; Änderungen währenddessen werden danach mit dem neuesten Entwurf gesendet.
// Sonst könnte eine langsame ältere Antwort die letzte Wahl überschreiben.
let saving = false, queued = null; // queued: { lock } für den nächsten Durchgang

async function save(lock) {
  if (!lock && awaitingTarget(ui.data, ui.draft)) { ui.error = ""; return render(); }
  if (saving) { queued = { lock: !!queued?.lock || lock }; return; }
  saving = true;
  try {
    for (;;) {
      ui.error = "";
      const { _editing, ...move } = ui.draft;
      const sent = JSON.stringify(move);
      try {
        ui.data = await api(`/api/p/${ui.key}/move`, { move, lock });
        const { _editing: editing, ...current } = ui.draft;
        // Den gespeicherten Stand (z. B. nach einem Tageswechsel bereinigt) nur übernehmen, wenn sich nichts mehr geändert hat
        if (!queued && JSON.stringify(current) === sent) {
          ui.draft = { ...(ui.data.myMove?.move ?? { vote: null, cardId: null }), _editing: lock ? false : editing };
          if (lock) ui.step = 0;
        }
      } catch (e) {
        ui.error = e.message;
        // Stand neu laden (z. B. Spiel inzwischen abgebrochen oder neuer Tag); den Entwurf behalten
        ui.data = await api(`/api/p/${ui.key}`).catch(() => ui.data);
      }
      if (!queued) break;
      lock = queued.lock; queued = null;
      if (!lock && awaitingTarget(ui.data, ui.draft)) break;
    }
  } finally { saving = false; }
  render();
}

export async function startPlayer(key) {
  ui.key = key;
  const load = async () => {
    ui.data = await api(`/api/p/${key}`);
    ui.draft = { ...(ui.data.myMove?.move ?? { vote: null, cardId: null }) };
    render();
  };
  const first = api(`/api/p/${key}`); // parallel zur Push-Abfrage
  ui.push = await pushState().catch(() => "hidden");
  if (ui.push === "on" || ui.push === "unsupported") ui.push = "hidden";
  const cancelled = (await first).cancelled;
  // Abgebrochenes Spiel: keine automatische Einführung, kein Push-Abgleich (sonst wanderte das Abo vom neuen Spiel hierher)
  if (!seenIntro() && !cancelled) ui.intro = 0;
  if (!cancelled) syncPush(key).catch(() => {}); // still im Hintergrund, die Seite wartet nicht darauf
  ui.data = await first;
  ui.draft = { ...(ui.data.myMove?.move ?? { vote: null, cardId: null }) };
  render();
  // Bei Rückkehr zur Seite neu laden (neuer Tag, andere Spieler), aber nicht mitten im Bearbeiten
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !ui.draft?._editing && ui.intro < 0) load().catch(() => {}); });
}

