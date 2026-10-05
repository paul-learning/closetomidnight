// Kopf (Nation, Uhr, Reiter) und die Reiter Zeitung, Allianz, Ergebnis.
import { T, esc, fmt } from "../util.js";
import { goalText, nation, tag } from "../names.js";
import { clockPanel } from "../components.js";

const C = T.client;

export function header(d, tab) {
  return `<header class="who"><h1>${nation(d.me.nation)}</h1><span class="meta">${esc(d.me.playerName)} · ${fmt(C.dayOf, { day: d.day, days: d.rules.days })}
      <button class="link" id="help" aria-label="${C.help}">?</button></span></header>
    <div class="purse"><div><b>${d.me.pk}</b>${C.influence}</div><div><b>${d.me.vp}</b>${C.victoryPoints}</div></div>
    ${clockPanel(d)}
    <nav class="tabs" role="tablist">${[["zug", d.over ? C.tabResult : C.tabMove], ["zeitung", C.tabPaper], ["allianz", C.tabAlliance]]
      .map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" data-tab="${k}">${l}</button>`).join("")}</nav>`;
}

/** Kasten „Das ging gegen dich“: Karten und Anklage gegen den Spieler am zuletzt aufgelösten Tag. */
export function incomingBox(d) {
  const inc = d.incoming;
  if (!inc || d.cancelled) return "";
  const lines = inc.cards.map(c => {
    const vars = { nation: nation(c.nation), card: T.cards[c.card] ?? c.card };
    if (c.fizzled) return fmt(C.incomingFizzled, vars);
    const def = d.me.defector, parts = [];
    if (c.blockedMine !== null) parts.push(c.blockedMine ? C.incomingBlocked : C.incomingBlockedNothing);
    if (c.stolen !== null) parts.push(c.stolen > 0 ? fmt(C.incomingSteal, { n: c.stolen }) : C.incomingStealNothing);
    if (c.vpLost) parts.push(c.vpLost === 1 ? C.incomingSanctionOne : fmt(C.incomingSanction, { n: c.vpLost }));
    if (c.leaked) parts.push(c.leaked > 1 ? (def ? C.incomingLeakAllDefector : C.incomingLeakAll) : (def ? C.incomingLeakDefector : C.incomingLeak));
    return fmt(C.incomingCard, vars) + (parts.length ? ": " + parts.join(", ") : "") + ".";
  });
  if (inc.accused) lines.push(inc.accused.correct ? C.incomingAccusedRight : C.incomingAccusedWrong);
  return `<section class="incoming" aria-label="${fmt(C.incomingTitle, { day: inc.day })}"><b>${fmt(C.incomingTitle, { day: inc.day })}</b>
    <ul>${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul></section>`;
}

/** Kasten „Dein Geheimdienst meldet“: was der eigene Leak am zuletzt aufgelösten Tag aufgedeckt hat. */
export function intelBox(d) {
  const news = d.me.intelNew ?? [];
  if (!news.length || d.cancelled || d.over) return ""; // nach Spielende zeigt die Auswertung ohnehin alle Ziele
  const title = fmt(C.intelNewTitle, { day: news[0].day });
  return `<section class="intel-new" aria-label="${esc(title)}"><b>${esc(title)}</b>
    <ul>${news.map(x => `<li>${tag(x.kind)}${esc(fmt(C.intelLine, { nation: nation(x.nation), goal: goalText(x) }))}</li>`).join("")}</ul>
    <p class="hint">${C.intelNewHint}</p></section>`;
}

export function paperTab(d) {
  if (d.papers.length) return d.papers.map(p => `<div class="paper">${esc(p.text)}</div>`).join("");
  return `<p class="hint">${d.cancelled ? C.noPaperCancelled : fmt(C.firstPaper, { hour: d.rules.resolveHour })}</p>`;
}

/** Überweisen (solange das Spiel läuft) und Logbuch. form: Eingaben, die ein Neuzeichnen überleben sollen. */
function transferSection(d, form) {
  const others = d.players.filter(p => p.idx !== d.me.idx);
  const log = d.transfers.length
    ? `<ul class="log">${d.transfers.map(t => `<li><span class="hint">${fmt(C.dayShort, { day: t.day })}</span> ${esc(fmt(t.out ? C.transferOut : C.transferIn, { nation: nation(t.nation), amount: t.amount }))}${t.subject ? `<br><span class="subject">„${esc(t.subject)}“</span>` : ""}</li>`).join("")}</ul>`
    : `<p class="hint">${C.logEmpty}</p>`;
  const sendForm = d.over || d.cancelled ? "" : `<form id="transfer" class="transfer">
      <p class="hint">${fmt(C.transferHint, { free: `<b>${d.me.freePk}</b>`, reserved: d.me.reservedPk })}</p>
      <label class="field">${C.transferTo}<select name="to" data-local>${others.map(p => `<option value="${p.idx}" ${form.to === p.idx ? "selected" : ""}>${nation(p.nation)}</option>`).join("")}</select></label>
      <label class="field">${C.transferAmount}<input type="number" name="amount" data-local min="1" max="${d.me.freePk}" step="1" inputmode="numeric" value="${esc(form.amount ?? "")}"></label>
      <label class="field">${C.transferSubject}<input type="text" name="subject" data-local maxlength="${d.subjectMax}" value="${esc(form.subject ?? "")}" placeholder="${C.transferSubjectHint}"></label>
      <button class="btn" type="submit" ${d.me.freePk < 1 ? "disabled" : ""}>${C.transferSend}</button>
      <p class="hint">${C.transferRules}</p>
    </form>`;
  return `<h2>${C.transferTitle}</h2>${sendForm}<h3>${C.logTitle}</h3>${log}`;
}

export function allianceTab(d, form = {}) {
  return `<table class="table">${d.players.map(p => `<tr><td><b>${nation(p.nation)}</b> · ${esc(p.playerName)}${p.idx === d.me.idx ? ` ${C.you}` : ""}<br>
    <span class="hint">${p.pk} ${C.influence}</span></td><td class="${p.locked ? "ok" : ""}">${d.over ? "" : p.locked ? C.isLocked : C.isThinking}</td></tr>`).join("")}</table>
    <p class="hint">${C.secretPoints}</p>${transferSection(d, form)}`;
}

export function resultTab(d) {
  const midnight = d.ending !== "vernunft";
  const awards = p => [d.awards?.hero.includes(p.nation) && C.awardHero, d.awards?.arsonist.includes(p.nation) && C.awardArsonist, p.defector && C.defector].filter(Boolean).join(" · ");
  return `<div class="ending ${midnight ? "" : "saved"}"><div class="stencil">${T.endings[d.ending]}</div>
    <p>${d.winners.length ? fmt(C.wonBy, { names: d.winners.map(nation).join(", ") }) : C.nobodyWon}</p></div>
    <h2>${C.filesOpened}</h2><table class="table">${d.players.map(p => `<tr><td><b>${nation(p.nation)}</b> (${esc(p.playerName)})${awards(p) ? ` – ${awards(p)}` : ""}<br>
    <span class="hint">${p.goals.map(goalText).join("<br>")}</span></td><td>${p.vp} ${C.victoryPoints}</td></tr>`).join("")}</table>`;
}

