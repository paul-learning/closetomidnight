// Kopf (Nation, Uhr, Reiter) und die Reiter Zeitung, Allianz, Ergebnis.
import { T, esc, fmt } from "../util.js";
import { goalText, nation } from "../names.js";
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

export function paperTab(d) {
  return d.papers.length ? d.papers.map(p => `<div class="paper">${esc(p.text)}</div>`).join("") : `<p class="hint">${fmt(C.firstPaper, { hour: d.rules.resolveHour })}</p>`;
}

export function allianceTab(d) {
  return `<table class="table">${d.players.map(p => `<tr><td><b>${nation(p.nation)}</b> · ${esc(p.playerName)}${p.idx === d.me.idx ? ` ${C.you}` : ""}
    ${p.pk !== undefined ? `<br><span class="hint">${p.pk} ${C.influence}</span>` : ""}</td><td class="${p.locked ? "ok" : ""}">${d.over ? "" : p.locked ? C.isLocked : C.isThinking}</td></tr>`).join("")}</table>
    <p class="hint">${C.secretPoints}</p>`;
}

export function resultTab(d) {
  const midnight = d.ending !== "vernunft";
  const awards = p => [d.awards?.hero.includes(p.nation) && C.awardHero, d.awards?.arsonist.includes(p.nation) && C.awardArsonist, p.defector && C.defector].filter(Boolean).join(" · ");
  return `<div class="ending ${midnight ? "" : "saved"}"><div class="stencil">${T.endings[d.ending]}</div>
    <p>${d.winners.length ? fmt(C.wonBy, { names: d.winners.map(nation).join(", ") }) : C.nobodyWon}</p></div>
    <h2>${C.filesOpened}</h2><table class="table">${d.players.map(p => `<tr><td><b>${nation(p.nation)}</b> (${esc(p.playerName)})${awards(p) ? ` – ${awards(p)}` : ""}<br>
    <span class="hint">${p.goals.map(goalText).join("<br>")}</span></td><td>${p.vp} ${C.victoryPoints}</td></tr>`).join("")}</table>`;
}

