// Einführung beim ersten Besuch (drei Seiten). Der „?“-Knopf öffnet sie wieder.
import { $, T, fmt } from "../util.js";

const C = T.client;

export const seenIntro = () => { try { return localStorage.getItem("fvz-intro") === "1"; } catch { return false; } };
const markIntro = () => { try { localStorage.setItem("fvz-intro", "1"); } catch { /* privates Fenster */ } };

/** Zeigt Seite `page`; ruft onDone(), wenn die Einführung beendet oder übersprungen wird, sonst onPage(neueSeite). */
export function renderIntro(page, rules, onPage, onDone) {
  const pages = C.intro, [title, text] = pages[page], last = page === pages.length - 1;
  $("#app").innerHTML = `<section class="intro"><div class="stencil">${title}</div>
    <p>${fmt(text, { hour: rules.resolveHour, defectDay: rules.defectFromDay })}</p>
    <div class="dots">${pages.map((_, k) => `<i class="${k === page ? "on" : ""}"></i>`).join("")}</div></section>`;
  const el = $("#bar"); el.hidden = false;
  el.innerHTML = `<div class="inner"><button class="btn ghost" id="skip">${last ? C.back : C.introSkip}</button><button class="btn" id="on">${last ? C.introGo : C.next}</button></div>`;
  $("#on").addEventListener("click", () => { if (last) { markIntro(); onDone(); } else onPage(page + 1); });
  $("#skip").addEventListener("click", () => { if (last) onPage(page - 1); else { markIntro(); onDone(); } });
}
