// Gemeinsame Typen der Spielregeln. Keine Texte: alles Sichtbare steht in src/i18n.

export type Track = "krieg" | "autokratie" | "kollaps";
export const TRACKS: Track[] = ["krieg", "autokratie", "kollaps"];

export type NationId = "teutonien" | "gallien" | "polonien" | "italica";
export const NATIONS: NationId[] = ["teutonien", "gallien", "polonien", "italica"];

export type PowerId = "trampel" | "putsch" | "xistabil" | "moschus";

export interface Response {
  id: string;
  costEach: number; // Einfluss, den JEDER zahlt, wenn beschlossen
  reduce: number; // wie viel der Krisenschwere aufgehoben wird
  unanimous: boolean; // stärkste Option: braucht mehr Stimmen
  bonus?: { nation: NationId; vp: number }; // begünstigt eine Nation
}

export interface Crisis {
  id: string;
  track: Track;
  severity: number;
  responses: Response[]; // stärkste zuerst, schwächste zuletzt
}

export type CardKind = "sauber" | "schmutzig" | "interaktion";
export interface Card {
  id: string;
  kind: CardKind;
  cost: number;
  vp?: number;
  pk?: number; // Einfluss-Gewinn
  tracks?: Partial<Record<Track, number>>;
  steal?: number; // Einfluss von einem Ziel nehmen
  leak?: number | true; // so viele geheime Ziele des Ziels aufdecken (true: alte Spielstände, zählt als 1)
  sanction?: number; // das Ziel verliert so viele Siegpunkte
  block?: boolean; // die Karte des Ziels verpufft heute (bezahlt ist sie trotzdem)
  everyonePk?: number; // alle Spieler (auch du) bekommen so viel Einfluss
}

export interface Offer {
  id: string;
  power: PowerId;
  calls: boolean; // ruft im Modus "drei" an (Staaten, nicht Moschus)
  vp: number;
  pk: number;
  track: Track | "krise"; // "krise": wirkt auf den Track der aktuellen Krise
  doom: number;
}

export interface GoalCtx {
  tracks: Record<Track, number>;
  me: { pk: number; offersAccepted: number; majorityVotes: number; dirtyPlayed: number; cleanPlayed: number };
  others: { pk: number }[];
}
export interface Goal { id: string; kind: "sauber" | "schmutzig"; vp: number; check: (c: GoalCtx) => boolean }
