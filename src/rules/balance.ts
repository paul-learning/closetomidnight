// Alle Stellschrauben der Spielbalance an einem Ort. Nach Änderungen: node src/tools/simulate.ts

export const BALANCE = {
  days: 7,
  trackStart: 3,
  trackMax: 10, // erreicht ein Track diesen Wert, schlägt es sofort Mitternacht
  midnightTotal: 24, // Summe aller Tracks, bei der es Mitternacht schlägt
  startPk: 4,
  pkPerDay: 3,
  handSize: 3,
  offerMode: "drei" as "eins" | "drei" | "vier", // eins: ein Angebot reihum · drei: drei Staaten rufen an, einer bleibt leer · vier: jeder bekommt einen Anruf
  strongmanDriftPerDay: 0, // zufällige Doom-Punkte durch Großmächte pro Tag
  votesNeeded: 2, // normale Ratsoptionen
  votesNeededStrong: 3, // stärkste Ratsoption
  defectFromDay: 4,
  defectorBonusPk: 3,
  heroBonus: 5, // bei Überleben: wer die Uhr am meisten zurückgedreht hat
  arsonistPenalty: 3, // bei Überleben: wer die meisten Doom-Punkte verursacht hat
  accuseVotesNeeded: 2, // von den 3 anderen Spielern
  accuseWrongPenalty: 2,
  accuseRightClockBack: 2,
};
