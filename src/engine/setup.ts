// Spielstart und tägliches Austeilen der Angebote.
import { BALANCE } from "../rules/balance.ts";
import { CARD_POOL, CRISES, GOALS, OFFERS } from "../rules/content.ts";
import { NATION_RULES } from "../rules/nations.ts";
import { NATIONS } from "../rules/types.ts";
import type { PowerId, Track } from "../rules/types.ts";
import { rng, shuffle } from "./rng.ts";
import type { GameState, Player } from "./state.ts";

const POWERS: PowerId[] = ["trampel", "putsch", "xistabil", "moschus"];

export function newGame(seed: number): GameState {
  const rnd = rng(seed);
  let deck = shuffle(CARD_POOL.flatMap(([c, n]) => Array(n).fill(c)), rnd);
  const clean = shuffle(GOALS.filter(g => g.kind === "sauber"), rnd);
  const dirty = shuffle(GOALS.filter(g => g.kind === "schmutzig"), rnd);
  const players: Player[] = NATIONS.map((nation, i) => {
    const hand = deck.slice(0, BALANCE.handSize); deck = deck.slice(BALANCE.handSize);
    return {
      nation, pk: BALANCE.startPk + NATION_RULES[nation].startBonusPk, vp: 0, hand, goals: [clean[i].id, dirty[i].id], intel: [],
      defector: false, exposed: false, vetoUsed: false,
      stats: { offersAccepted: 0, majorityVotes: 0, dirtyPlayed: 0, cleanPlayed: 0, weakVotes: 0, lateDirty: 0, saved: 0, caused: 0 },
    };
  });
  const crisisDeck = shuffle(CRISES, rnd);
  return {
    day: 1, tracks: { krieg: BALANCE.trackStart, autokratie: BALANCE.trackStart, kollaps: BALANCE.trackStart }, players,
    crisis: crisisDeck[0], nextCrisis: crisisDeck[1], crisisDeck: crisisDeck.slice(2),
    offers: dealOffers(1, rnd, crisisDeck[0].track), deck, accusationUsed: false, over: false, history: [], seed, rngState: Math.floor(rnd() * 2 ** 31),
  };
}

/** Wer heute anruft und mit welchem Angebot.
 *  "eins": eine Großmacht reihum · "drei": die drei Staaten rufen an, einer bleibt reihum leer · "vier": alle vier rufen an. */
export function dealOffers(day: number, rnd: () => number, crisisTrack: Track): GameState["offers"] {
  const pick = (power: PowerId) => {
    const pool = OFFERS.filter(o => o.power === power);
    const o = pool[Math.floor(rnd() * pool.length)];
    return { ...o, track: o.track === "krise" ? crisisTrack : o.track };
  };
  if (BALANCE.offerMode === "eins") return [{ to: (day - 1) % 4, offer: pick(POWERS[Math.floor(rnd() * POWERS.length)]) }];
  if (BALANCE.offerMode === "vier") return shuffle(POWERS, rnd).map((p, to) => ({ to, offer: pick(p) }));
  const skip = (day - 1) % 4;
  const callers = shuffle(POWERS.filter(p => OFFERS.some(o => o.power === p && o.calls)), rnd);
  return [0, 1, 2, 3].filter(i => i !== skip).map((to, k) => ({ to, offer: pick(callers[k]) }));
}
