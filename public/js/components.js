// Wiederverwendbare Bausteine: Uhr und Track-Anzeigen.
import { T, fmt } from "./util.js";

export function clockSvg(time, midnight) {
  const [h, m] = midnight ? [12, 0] : time.split(":").map(Number);
  const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30 * Math.PI / 180, r1 = i === 0 ? 52 : 56, r2 = 64;
    return `<line x1="${74 + r1 * Math.sin(a)}" y1="${74 - r1 * Math.cos(a)}" x2="${74 + r2 * Math.sin(a)}" y2="${74 - r2 * Math.cos(a)}" stroke="${i === 0 ? "var(--red)" : "var(--mute)"}" stroke-width="${i === 0 ? 5 : 2}"/>`;
  }).join("");
  return `<svg viewBox="0 0 148 148" role="img" aria-label="${fmt(T.client.clockLabel, { time: midnight ? "00:00" : time })}">
    <path d="M74 74 L74 6 A68 68 0 0 1 108 15.1 Z" fill="var(--red)" opacity=".18" transform="rotate(-30 74 74)"/>
    <circle cx="74" cy="74" r="68" fill="none" stroke="var(--rule)" stroke-width="3"/>${ticks}
    <line class="hand" x1="74" y1="74" x2="74" y2="36" stroke="var(--paper)" stroke-width="5" stroke-linecap="round" transform="rotate(${ha} 74 74)"/>
    <line class="hand" x1="74" y1="78" x2="74" y2="18" stroke="var(--amber)" stroke-width="3" stroke-linecap="round" transform="rotate(${ma} 74 74)"/>
    <circle cx="74" cy="74" r="4" fill="var(--amber)"/></svg>`;
}

export function gauges(tracks, max) {
  return Object.keys(T.tracks).map(t => `<div class="gauge"><span>${T.tracks[t]}</span><span class="cells">${
    Array.from({ length: max }, (_, i) => `<i class="${i < tracks[t] ? (i >= 7 ? "on" : "warn") : ""}"></i>`).join("")}</span><b>${tracks[t]}</b></div>`).join("");
}

export function clockPanel(d) {
  const midnight = d.over && d.ending !== "vernunft";
  return `<section class="clock">${clockSvg(d.clock, midnight)}<div>
    <div class="time ${d.minutesLeft <= 30 || midnight ? "late" : ""}">${midnight ? "00:00" : d.clock}</div>
    <div class="left">${midnight ? T.client.midnight : fmt(T.client.minutesLeft, { minutes: d.minutesLeft })}</div>${gauges(d.tracks, d.rules.trackMax)}</div></section>`;
}
