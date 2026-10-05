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

// Jede Karte genau einmal im Stapel. Drei Klassen: normal (0–3 Einfluss, die Hälfte),
// krass (5–6, knapp ein Drittel) und richtig krass (7–8, ein Fünftel). Die teuren sind der Grund zu sparen und zu verhandeln.
// Interaktionskarten brauchen ein Ziel.
export const CARDS: Card[] = [
  // normal · sauber
  { id: "gipfel", kind: "sauber", cost: 3, vp: 2, tracks: { krieg: -2 } },
  { id: "faktencheck", kind: "sauber", cost: 2, vp: 1, tracks: { kollaps: -1 } },
  { id: "pressefreiheit", kind: "sauber", cost: 3, vp: 2, tracks: { autokratie: -2 } },
  { id: "konjunktur", kind: "sauber", cost: 3, vp: 2, tracks: { kollaps: -2 } },
  { id: "abruestung", kind: "sauber", cost: 2, vp: 1, tracks: { krieg: -1 } },
  { id: "buergerrat", kind: "sauber", cost: 2, vp: 1, tracks: { autokratie: -1 } },
  { id: "lichterkette", kind: "sauber", cost: 1, tracks: { autokratie: -1 } },
  { id: "tempolimit", kind: "sauber", cost: 1, tracks: { kollaps: -1 } },
  // normal · schmutzig
  { id: "waffendeal", kind: "schmutzig", cost: 1, vp: 3, tracks: { krieg: 1 } },
  { id: "notstand", kind: "schmutzig", cost: 0, vp: 2, pk: 2, tracks: { autokratie: 1 } },
  { id: "steuerdumping", kind: "schmutzig", cost: 1, vp: 3, tracks: { kollaps: 1 } },
  { id: "propaganda", kind: "schmutzig", cost: 0, vp: 2, tracks: { autokratie: 1 } },
  { id: "diaeten", kind: "schmutzig", cost: 0, pk: 4, tracks: { autokratie: 1 } },
  { id: "soeldner", kind: "schmutzig", cost: 2, vp: 4, tracks: { krieg: 1 } },
  // normal · interaktion
  { id: "erpressung", kind: "interaktion", cost: 2, steal: 2 },
  { id: "leak", kind: "interaktion", cost: 2, leak: 1 },
  { id: "sanktionen", kind: "interaktion", cost: 1, sanction: 1 },
  { id: "abwerbung", kind: "interaktion", cost: 2, vp: 1, steal: 1 },
  { id: "strafzoelle", kind: "interaktion", cost: 1, steal: 1, tracks: { kollaps: 1 } },
  { id: "ballon", kind: "interaktion", cost: 1, leak: 1, tracks: { krieg: 1 } },
  // krass · sauber
  { id: "weltfrieden", kind: "sauber", cost: 6, vp: 4, tracks: { krieg: -3, autokratie: -1 } },
  { id: "gruenerdeal", kind: "sauber", cost: 5, vp: 4, tracks: { kollaps: -3 } },
  { id: "verfassung", kind: "sauber", cost: 5, vp: 3, tracks: { autokratie: -3 } },
  { id: "marshallplan", kind: "sauber", cost: 5, vp: 3, tracks: { kollaps: -2, krieg: -1 } },
  // krass · schmutzig
  { id: "staatsstreich", kind: "schmutzig", cost: 5, vp: 6, tracks: { autokratie: 1 } },
  { id: "ruestungsboom", kind: "schmutzig", cost: 5, vp: 5, pk: 2, tracks: { krieg: 1 } },
  { id: "steueroase", kind: "schmutzig", cost: 5, vp: 6, tracks: { kollaps: 1 } },
  { id: "botarmee", kind: "schmutzig", cost: 6, vp: 7, tracks: { autokratie: 1 } },
  // krass · interaktion
  { id: "handelskrieg", kind: "interaktion", cost: 5, steal: 2, sanction: 2 },
  { id: "cyberangriff", kind: "interaktion", cost: 5, block: true },
  { id: "doppelagent", kind: "interaktion", cost: 6, leak: 2 },
  { id: "ausweisung", kind: "interaktion", cost: 5, sanction: 3 },
  // richtig krass · sauber
  { id: "weltregierung", kind: "sauber", cost: 8, vp: 3, tracks: { krieg: -2, autokratie: -2, kollaps: -2 } },
  { id: "nobelpreis", kind: "sauber", cost: 7, vp: 6, tracks: { krieg: -2 } },
  { id: "grundeinkommen", kind: "sauber", cost: 7, vp: 2, everyonePk: 3, tracks: { kollaps: -2 } },
  // richtig krass · schmutzig
  { id: "atomtest", kind: "schmutzig", cost: 7, vp: 9, tracks: { krieg: 2 } },
  { id: "ermaechtigung", kind: "schmutzig", cost: 8, vp: 10, tracks: { autokratie: 2 } },
  { id: "marskolonie", kind: "schmutzig", cost: 7, vp: 7, pk: 2, tracks: { kollaps: 1 } },
  // richtig krass · interaktion
  { id: "regimewechsel", kind: "interaktion", cost: 8, steal: 4, sanction: 4 },
  { id: "wahlhack", kind: "interaktion", cost: 7, steal: 3, block: true },
];

/** 0 = normal, 1 = krass, 2 = richtig krass (nach Grundpreis, ohne Rabatte). */
export const cardTier = (c: Card) => c.cost >= 7 ? 2 : c.cost >= 5 ? 1 : 0;
export const cardById = (id: string) => CARDS.find(c => c.id === id);

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
