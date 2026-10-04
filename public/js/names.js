// Von IDs zu Namen und Effekttexten. Alle Wörter kommen aus window.T (src/i18n).
import { T, fmt } from "./util.js";

const C = T.client;
export const nation = id => T.nations[id].name;
export const crisisName = c => T.crises[c.id].name;
export const responseName = (c, rid) => T.crises[c.id].responses[rid];
export const cardName = c => T.cards[c.id];
export const powerName = p => T.powers[p].name;
export const goalText = g => T.goals[g.id ?? g];

export function cardEffects(c) {
  const parts = [fmt(C.fx.cost, { n: c.effCost ?? c.cost })];
  if (c.vp) parts.push(fmt(C.fx.vp, { n: c.vp }));
  if (c.pk) parts.push(fmt(C.fx.pk, { n: c.pk }));
  for (const [t, v] of Object.entries(c.tracks || {})) parts.push(`${T.tracks[t]} ${v > 0 ? "+" : "−"}${Math.abs(v)}`);
  if (c.steal) parts.push(fmt(C.fx.steal, { n: c.steal }));
  if (c.leak) parts.push(C.fx.leak);
  return parts.join(" · ");
}

export const offerEffects = o => [o.vp && fmt(C.fx.vp, { n: o.vp }), o.pk && fmt(C.fx.pk, { n: o.pk }), `${T.tracks[o.track]} +${o.doom}`].filter(Boolean).join(" · ");

export function responseEffects(r, crisis, rules) {
  let s = fmt(C.responseEffects, { cost: r.costEach, reduce: r.reduce, severity: crisis.severity, votes: r.unanimous ? rules.votesNeededStrong : rules.votesNeeded });
  if (r.bonus) s += " · " + fmt(C.responseBonus, { nation: nation(r.bonus.nation), vp: r.bonus.vp });
  return s;
}
