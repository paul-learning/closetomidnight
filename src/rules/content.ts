// Spielinhalt: Krisen, Karten, Angebote, Ziele. Nur IDs und Zahlen; Namen stehen in src/i18n.
// Die Reihenfolge ist Teil des Seeds: Änderungen verschieben die Simulationsergebnisse.
import type { Card, Crisis, Goal, NationId, Offer, Response } from "./types.ts";

const r = (id: string, costEach: number, reduce: number, unanimous = false, bonus?: { nation: NationId; vp: number }): Response =>
  ({ id, costEach, reduce, unanimous, bonus });

export const CRISES: Crisis[] = [
  { id: "gasstopp", track: "kollaps", severity: 4, responses: [r("fonds", 2, 4, true), r("lng", 1, 3, false, { nation: "italica", vp: 2 }), r("sparen", 0, 1)] },
  { id: "manoever", track: "krieg", severity: 3, responses: [r("brigade", 2, 3, true), r("ruestung", 1, 2, false, { nation: "polonien", vp: 2 }), r("dialog", 0, 1)] },
  { id: "zoelle", track: "kollaps", severity: 3, responses: [r("gegen", 2, 3, true), r("deal", 1, 2, false, { nation: "teutonien", vp: 2 }), r("ausharren", 0, 1)] },
  { id: "putschgeruechte", track: "autokratie", severity: 3, responses: [r("sanktionen", 2, 3, true), r("vermittlung", 1, 2, false, { nation: "gallien", vp: 2 }), r("ignorieren", 0, 1)] },
  { id: "trollfabrik", track: "autokratie", severity: 4, responses: [r("gesetz", 2, 4, true), r("faktencheck", 1, 3, false, { nation: "gallien", vp: 2 }), r("appell", 0, 1)] },
  { id: "fluechtlinge", track: "kollaps", severity: 3, responses: [r("verteilung", 2, 3, true), r("geld", 1, 2, false, { nation: "italica", vp: 2 }), r("zaun", 0, 1)] },
  { id: "drohnen", track: "krieg", severity: 3, responses: [r("abwehr", 2, 3, true), r("rheinwerk", 1, 2, false, { nation: "teutonien", vp: 2 }), r("schulterzucken", 0, 1)] },
  { id: "haefen", track: "autokratie", severity: 2, responses: [r("pruefung", 2, 2, true), r("gegenkauf", 1, 2, false, { nation: "polonien", vp: 2 }), r("danke", 0, 0)] },
  { id: "atom", track: "krieg", severity: 4, responses: [r("abschreckung", 2, 4, true), r("schirm", 1, 3, false, { nation: "gallien", vp: 2 }), r("tauben", 0, 1)] },
  { id: "bankencrash", track: "kollaps", severity: 3, responses: [r("rettung", 2, 3, true), r("bundesbank", 1, 2, false, { nation: "teutonien", vp: 2 }), r("markt", 0, 0)] },
];

// Je Karte die Anzahl im Stapel
export const CARD_POOL: [Card, number][] = [
  [{ id: "gipfel", kind: "sauber", cost: 3, vp: 2, tracks: { krieg: -2 } }, 4],
  [{ id: "faktencheck", kind: "sauber", cost: 2, vp: 1, tracks: { kollaps: -1 } }, 3],
  [{ id: "pressefreiheit", kind: "sauber", cost: 3, vp: 2, tracks: { autokratie: -2 } }, 4],
  [{ id: "konjunktur", kind: "sauber", cost: 3, vp: 2, tracks: { kollaps: -2 } }, 4],
  [{ id: "waffendeal", kind: "schmutzig", cost: 1, vp: 3, tracks: { krieg: 1 } }, 3],
  [{ id: "notstand", kind: "schmutzig", cost: 0, vp: 2, pk: 2, tracks: { autokratie: 1 } }, 2],
  [{ id: "steuerdumping", kind: "schmutzig", cost: 1, vp: 3, tracks: { kollaps: 1 } }, 3],
  [{ id: "propaganda", kind: "schmutzig", cost: 0, vp: 2, tracks: { autokratie: 1 } }, 1],
  // Interaktion: braucht ein Ziel. Mehr Exemplare, damit fast jeder im Spiel eine zu sehen bekommt.
  [{ id: "erpressung", kind: "interaktion", cost: 2, steal: 2 }, 5],
  [{ id: "leak", kind: "interaktion", cost: 2, leak: true }, 4],
  [{ id: "sanktionen", kind: "interaktion", cost: 1, sanction: 1 }, 2],
];

// Je Großmacht mehrere Angebote; bei einem Anruf wird eines davon gezogen.
export const OFFERS: Offer[] = [
  { id: "grossartig", power: "trampel", calls: true, vp: 3, pk: 0, track: "kollaps", doom: 1 },
  { id: "zollbefreiung", power: "trampel", calls: true, vp: 1, pk: 2, track: "kollaps", doom: 1 },
  { id: "golfplatz", power: "trampel", calls: true, vp: 2, pk: 1, track: "krieg", doom: 1 },
  { id: "gas", power: "putsch", calls: true, vp: 1, pk: 3, track: "krieg", doom: 1 },
  { id: "schulden", power: "putsch", calls: true, vp: 2, pk: 1, track: "autokratie", doom: 1 },
  { id: "wahlhilfe", power: "putsch", calls: true, vp: 3, pk: 0, track: "autokratie", doom: 1 },
  { id: "hafen", power: "xistabil", calls: true, vp: 2, pk: 1, track: "krieg", doom: 1 },
  { id: "kredit", power: "xistabil", calls: true, vp: 0, pk: 4, track: "kollaps", doom: 1 },
  { id: "kameras", power: "xistabil", calls: true, vp: 3, pk: 0, track: "autokratie", doom: 1 },
  { id: "algorithmus", power: "moschus", calls: false, vp: 2, pk: 2, track: "krise", doom: 1 },
  { id: "satelliten", power: "moschus", calls: false, vp: 1, pk: 3, track: "krise", doom: 1 },
  { id: "kampagne", power: "moschus", calls: false, vp: 3, pk: 0, track: "krise", doom: 1 },
];

export const GOALS: Goal[] = [
  { id: "kollaps-niedrig", kind: "sauber", vp: 4, check: c => c.tracks.kollaps <= 3 },
  { id: "krieg-niedrig", kind: "sauber", vp: 4, check: c => c.tracks.krieg <= 3 },
  { id: "autokratie-niedrig", kind: "sauber", vp: 4, check: c => c.tracks.autokratie <= 3 },
  { id: "mehrheit", kind: "sauber", vp: 4, check: c => c.me.majorityVotes >= 5 },
  { id: "unbestechlich", kind: "sauber", vp: 4, check: c => c.me.offersAccepted === 0 },
  { id: "krieg-hoch", kind: "schmutzig", vp: 5, check: c => c.tracks.krieg >= 6 },
  { id: "autokratie-hoch", kind: "schmutzig", vp: 5, check: c => c.tracks.autokratie >= 6 },
  { id: "drei-angebote", kind: "schmutzig", vp: 5, check: c => c.me.offersAccepted >= 3 },
  { id: "reichster", kind: "schmutzig", vp: 5, check: c => c.others.every(o => c.me.pk > o.pk) },
  { id: "drei-schmutzig", kind: "schmutzig", vp: 5, check: c => c.me.dirtyPlayed >= 3 },
];
