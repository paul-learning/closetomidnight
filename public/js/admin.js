// Spielleitung: Links verteilen, Tag auflösen, Einstellungen, Zeitung teilen.
import { $, $$, T, esc, fmt, api } from "./util.js";
import { nation } from "./names.js";
import { shareFrontPage } from "./admin/frontpage.js";

const C = T.client;
let data = null, error = "", key = "", testResult = { ai: "" };

function render() {
  const d = data, all = d.players.every(p => p.locked), running = !d.over && !d.cancelled;
  const status = p => p.locked ? `<span class="ok">${C.statusLocked}</span>` : p.saved ? C.statusDraft : C.statusNone;
  $("#app").innerHTML = `
    <header class="who"><h1>${C.adminTitle}</h1><span class="meta">${fmt(C.dayOf, { day: d.day, days: d.days })}${d.cancelled ? ` · ${C.cancelledShort}` : d.over ? ` · ${C.ended}` : ""}</span></header>
    ${error ? `<div class="err" role="alert">${esc(error)}</div>` : ""}
    ${d.cancelled ? `<div class="err" role="status">${C.cancelledAdmin} <a class="link" href="/">${C.toStart}</a></div>` : ""}
    ${d.cancelled ? "" : `<h2>${C.linksTitle}</h2><p class="hint">${C.linksHint}</p>
    ${d.players.map((p, i) => `<div class="field"><b>${nation(p.nation)}</b> · ${status(p)}
      <div class="copy"><input type="text" name="name${i}" value="${esc(p.name)}" aria-label="${fmt(C.nameLabel, { nation: nation(p.nation) })}"></div>
      <div class="copy"><input type="text" readonly value="${esc(p.url)}" aria-label="${C.linkLabel}"><button class="btn ghost" data-copy="${esc(p.url)}">${C.copy}</button></div>
      ${passwordRow(p, i, d.newPassword)}</div>`).join("")}
    <button class="btn ghost" id="names">${C.saveNames}</button>
    <h2>${C.resolveTitle}</h2><p class="hint">${fmt(C.resolveHint, { hour: d.resolveHour })}</p>
    <button class="btn ${all ? "" : "red"}" id="resolve" ${running ? "" : "disabled"}>${all ? C.resolveNow : C.resolveAnyway}</button>
    ${running ? `<div class="danger"><b>${C.cancelTitle}</b><p class="hint">${C.cancelHint}</p>
      <button class="btn red" id="cancel">${C.cancelButton}</button></div>` : ""}
    <h2>${C.settings}</h2>
    <label class="switch field"><input type="checkbox" id="bots" ${d.bots ? "checked" : ""}> ${C.botsLabel}</label>
    <button class="btn ghost" id="settings">${C.saveSettings}</button>
    <h2>${C.statusTitle}</h2><p class="hint">${C.statusHint}</p>
    <table class="table">
      <tr><td><b>${C.statusAi}</b><br><span class="hint">${d.status.ai ? `${C.statusOn} (${esc(d.status.aiModel)})` : C.statusOff}</span>${testResult.ai ? `<br>${testResult.ai}` : ""}</td>
        <td><button class="btn ghost" id="test-ai">${C.testAi}</button></td></tr>
      <tr><td><b>${C.statusPush}</b><br><span class="hint">${fmt(C.statusPushCount, { n: d.status.pushPlayers })}</span></td><td></td></tr>
    </table>`}
    <h2>${C.paperTitle}</h2>${d.papers.length ? `<p class="hint">${C.shareHint}</p>` : ""}
    ${d.papers.map((p, i) => `<button class="btn" data-share="${i}">${fmt(C.shareButton, { day: p.day })}</button><div class="paper">${esc(p.text)}</div>`).join("") || `<p class="hint">${d.cancelled ? C.noPaperCancelled : C.noPaper}</p>`}`;
  $$("[data-copy]").forEach(b => b.addEventListener("click", () => { navigator.clipboard?.writeText(b.dataset.copy); b.textContent = C.copied; }));
  $("#resolve")?.addEventListener("click", e => {
    if (!confirm(fmt(C.resolveConfirm, { day: d.day }))) return;
    e.target.disabled = true; e.target.textContent = C.resolving;
    act("resolve", {});
  });
  $("#cancel")?.addEventListener("click", () => { if (confirm(C.cancelConfirm)) act("cancel", {}); });
  $("#settings")?.addEventListener("click", () => act("settings", { bots: $("#bots").checked }));
  $$("[data-share]").forEach(b => b.addEventListener("click", async () => {
    b.disabled = true; b.textContent = C.sharing;
    try { await shareFrontPage(d.papers[Number(b.dataset.share)], d.days); } catch (e) { error = e.message; }
    render();
  }));
  $("#test-ai")?.addEventListener("click", e => runTest("ai", e.target));
  $$("[data-pw]").forEach(b => b.addEventListener("click", () => {
    const i = Number(b.dataset.pw), p = d.players[i];
    if (p.hasPassword && !confirm(fmt(C.pwConfirm, { nation: nation(p.nation) }))) return;
    act("password", { idx: i });
  }));
  $("#names")?.addEventListener("click", () => act("settings", { names: d.players.map((_, i) => $(`[name=name${i}]`).value) }));
}

// Passwort für die Startseite: Status, Knopf zum Erzeugen; ein neues wird genau einmal angezeigt.
function passwordRow(p, i, fresh) {
  const shown = fresh?.idx === i ? `<p class="hint">${fmt(C.pwShown, { nation: nation(p.nation) })}</p>
    <div class="copy"><input type="text" readonly value="${esc(fresh.password)}" aria-label="${C.password}"><button class="btn ghost" data-copy="${esc(fresh.password)}">${C.copy}</button></div>` : "";
  return `<div class="copy"><span class="hint">${p.hasPassword ? C.pwSet : C.pwNone}</span>
    <button class="btn ghost" data-pw="${i}">${p.hasPassword ? C.pwReset : C.pwNew}</button></div>${shown}`;
}

function describeTest(t) {
  if (t.ok) return `<span class="ok">${fmt(C.testAiOk, { sample: esc(t.sample) })}</span>`;
  const msg = t.reason === "noKey" ? C.testNoKey : fmt(C.testFailed, { detail: esc(t.detail ?? "") });
  return `<span class="err-text">${msg}</span>`;
}

async function runTest(kind, button) {
  button.disabled = true; button.textContent = C.testing;
  try { const r = await api(`/api/a/${key}/test-${kind}`, {}); testResult[kind] = describeTest(r.test); }
  catch (e) { testResult[kind] = `<span class="err-text">${esc(e.message)}</span>`; }
  render();
}

async function act(action, body) {
  error = "";
  try { data = await api(`/api/a/${key}/${action}`, body); } catch (e) { error = e.message; }
  render();
}

export async function startAdmin(k) {
  key = k;
  data = await api(`/api/a/${key}`);
  render();
}
