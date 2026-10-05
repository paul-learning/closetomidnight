// Die Schritte eines Tageszugs: Krise, Aktion, rotes Telefon, Geheimakte, Übersicht.
import { T, fmt } from "../util.js";
import { cardEffects, cardName, crisisName, goalText, nation, offerEffects, powerName, responseEffects, responseName } from "../names.js";

const C = T.client;
export const stepsFor = d => ["krise", "aktion", ...(d.offer ? ["telefon"] : []), "akte", "uebersicht"];
const tag = kind => `<span class="tag ${kind}">${T.kinds[kind]}</span>`;
const option = (name, value, checked, dis, body, extraClass = "") =>
  `<label class="opt ${extraClass}"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} ${dis}><span>${body}</span></label>`;


export const STEPS = {
  krise(d, m, dis) {
    const c = d.crisis;
    return `<p class="hint">${fmt(C.crisisHint, { votes: d.rules.votesNeeded, strong: d.rules.votesNeededStrong })}</p>
      <div class="file"><div class="title">${crisisName(c)}</div><div class="sub">${fmt(C.withoutDecision, { track: T.tracks[c.track], severity: c.severity })}</div>
      <div class="opts">${c.responses.map(r => option("vote", r.id, m.vote === r.id, dis,
        `<span class="n">${responseName(c, r.id)}</span><br><span class="d">${responseEffects(r, c, d.rules)}</span>`)).join("")}
        ${option("vote", "", !m.vote, dis, `<span class="n">${C.abstain}</span>`)}</div></div>
      ${d.nextCrisis ? `<p class="hint">${fmt(C.nextCrisis, { crisis: `<b>${crisisName(d.nextCrisis)}</b>` })}</p>` : ""}`;
  },
  aktion(d, m, dis) {
    const others = d.players.filter(p => p.idx !== d.me.idx);
    return `<p class="hint">${fmt(C.actionHint, { pk: d.me.pk })}</p><div class="opts">${d.me.hand.map(c => {
      const poor = c.effCost > d.me.pk;
      const target = c.kind === "interaktion" && m.cardId === c.id
        ? `<select name="target" ${dis}><option value="">${C.chooseTarget}</option>${others.map(p => `<option value="${p.idx}" ${m.target === p.idx ? "selected" : ""}>${nation(p.nation)}</option>`).join("")}</select>` : "";
      return option("card", c.id, m.cardId === c.id, dis || (poor ? "disabled" : ""),
        `${tag(c.kind)}<span class="n">${cardName(c)}</span><br><span class="d">${cardEffects(c)}${poor ? ` · ${C.tooExpensive}` : ""}</span>${target}`, poor ? "off" : "");
    }).join("")}${option("card", "", !m.cardId, dis, `<span class="n">${C.noCard}</span>`)}</div>`;
  },
  telefon(d, m, dis) {
    const o = d.offer;
    return `<p class="hint">${C.phoneHint}</p>
      <div class="phone"><div class="from">${powerName(o.power)}</div><q>${T.offers[o.id]}</q><div class="d">${offerEffects(o)}</div>
      <label class="switch spaced"><input type="checkbox" name="acceptOffer" ${m.acceptOffer ? "checked" : ""} ${dis}> ${C.acceptOffer}</label></div>`;
  },
  akte(d, m, dis) {
    const me = d.me, others = d.players.filter(p => p.idx !== me.idx);
    let h = `<p class="hint">${fmt(C.ability, { ability: T.nations[me.nation].ability })}</p><p><b>${C.yourGoals}</b></p>
      <ul class="secret">${me.goals.map(g => `<li>${tag(g.kind)}${goalText(g)} <span class="vp">${g.vp ? fmt(C.fx.vp, { n: g.vp }) : ""}</span></li>`).join("")}</ul>`;
    if (me.intel.length) h += `<p><b>${C.intel}</b></p><ul class="secret">${me.intel.map(x => `<li>${fmt(C.intelLine, { nation: nation(x.nation), goal: goalText(x.goal) })}</li>`).join("")}</ul>`;
    if (me.vetoAvailable) h += `<label class="switch danger"><input type="checkbox" name="veto" ${m.veto ? "checked" : ""} ${dis}> <span><b>${C.veto}</b> ${C.vetoText}</span></label>`;
    if (!d.accusationUsed) h += `<div class="danger"><b>${C.accuseTitle}</b><p class="hint">${fmt(C.accuseText, { votes: d.rules.accuseVotesNeeded, penalty: d.rules.accuseWrongPenalty })}</p>
      <select name="accuse" ${dis}><option value="">${C.accuseNobody}</option>${others.map(p => `<option value="${p.idx}" ${m.accuse === p.idx ? "selected" : ""}>${fmt(C.accuseOption, { nation: nation(p.nation) })}</option>`).join("")}</select></div>`;
    if (me.canDefect) h += `<label class="switch danger"><input type="checkbox" name="defect" ${m.defect ? "checked" : ""} ${dis}> <span><b>${C.defect}</b> ${fmt(C.defectText, { pk: d.rules.defectorBonusPk })}</span></label>`;
    else if (!me.defector && d.day < d.rules.defectFromDay) h += `<p class="hint">${fmt(C.defectLater, { day: d.rules.defectFromDay })}</p>`;
    return h;
  },
  uebersicht(d, m, dis) {
    const steps = stepsFor(d), me = d.me;
    const vote = d.crisis.responses.find(r => r.id === m.vote), card = me.hand.find(c => c.id === m.cardId);
    const target = card && m.target !== undefined ? d.players[m.target] : null;
    const pk = me.pk - (card?.effCost ?? 0) + (card?.pk ?? 0) + (m.acceptOffer && d.offer ? d.offer.pk : 0);
    const row = (st, title, text) => `<tr><td><b>${title}</b><br><span class="hint">${text}</span></td><td>${dis ? "" : `<button class="link" data-step="${steps.indexOf(st)}">${C.edit}</button>`}</td></tr>`;
    const extras = [m.veto && C.sumVeto, m.accuse !== undefined && fmt(C.accuseOption, { nation: nation(d.players[m.accuse].nation) }), m.defect && C.sumDefect].filter(Boolean);
    return `<table class="table summary">
      ${row("krise", C.sumCouncil, vote ? `${responseName(d.crisis, vote.id)}<br>${responseEffects(vote, d.crisis, d.rules)}` : C.abstain)}
      ${row("aktion", C.sumCard, card ? `${target ? fmt(C.sumAgainst, { card: cardName(card), target: nation(target.nation) }) : cardName(card)}<br>${cardEffects(card)}` : C.noCard)}
      ${d.offer ? row("telefon", C.sumPhone, m.acceptOffer ? `${fmt(C.sumAccepted, { power: powerName(d.offer.power) })}<br>${offerEffects(d.offer)}` : C.sumDeclined) : ""}
      ${row("akte", C.sumFile, extras.length ? extras.join("<br>") : C.sumNothing)}
    </table><p class="hint">${fmt(C.sumPk, { pk: `<b>${pk}</b>` })}</p>`;
  },
};
