// Zeitung: schlichte Zusammenfassung und der Auftrag an die KI.
export const newspaper = {
  paper: {
    title: "🗞 DER WELTUNTERGANGS-KURIER – Tag {day}",
    crisis: "Krise: {crisis}",
    passed: "Der Rat beschließt: {response}",
    vetoed: "{nation} legt ein Veto ein. Die Krise trifft voll.",
    noDeal: "Der Rat einigt sich nicht. Die Krise trifft voll.",
    voted: "• {nation} stimmte für: {response}",
    played: "• {nation} spielt „{card}“",
    playedAgainst: "• {nation} spielt „{card}“ gegen {target}",
    blocked: "– verpufft",
    transferred: "• Unter der Hand flossen {n} Einfluss. Wer an wen, weiß niemand.",
    rumour: "Gerüchte: {power} hat jemanden gekauft.",
    exposed: "Maulwurf enttarnt: {nation}!",
    falseSuspicion: "Falscher Verdacht gegen {nation}.",
    clock: "Uhr: {time} (Krieg {krieg}, Autokratie {autokratie}, Kollaps {kollaps})",
    midnight: "MITTERNACHT",
    end: "ENDE: {ending}",
    winners: "Sieger: {names}",
    hero: "Held der Vernunft: {names}",
    arsonist: "Brandstifter: {names}",
    nextCrisis: "Neue Krise: {crisis}",
    nobody: "niemand",
  },

  // ---- Auftrag an die KI-Zeitung ----
  prompt: {
    intro: `Du bist die Redaktion des „Weltuntergangs-Kurier“, einer satirischen Zeitung im Stil von „Dr. Seltsam“: trocken, absurd, schwarzhumorig.
Die Welt ist fiktiv. Spielernationen: Teutonien, Gallien, Polonien, Italica (die „Allianz der Vernunft“).
Großmächte: Präsident Donny Trampel (Großamerika), Präsident Wladimir Putsch (Moskowien), Vorsitzender Xistabil (Mittelreich), Tech-Mogul Elon Moschus.

Schreibe die Ausgabe zu Tag {day} auf Deutsch, höchstens 180 Wörter:
- eine knallige Schlagzeile
- 3–5 kurze Meldungen zu dem, was passiert ist (nenne, wer wie abgestimmt und welche Karte gespielt hat)
- ein erfundenes, kurzes Zitat einer Großmacht
- eine Zeile „Die Uhr steht auf {time}“
Schreibe reinen Text ohne Markdown: keine Sternchen, Rauten oder Unterstriche zur Hervorhebung. Die Schlagzeile steht in der ersten Zeile, jede Meldung in einer eigenen Zeile, die mit „• “ beginnt.
Erfinde KEINE neuen Ereignisse, Zahlen oder Folgen. Verrate nie, wer ein Angebot angenommen hat; sprich nur von Gerüchten.
Greife frühere Tage auf, wenn es passt (Verrat, Wortbruch, Wiederholungen).`,
    today: "Heute:",
    crisis: "Krise: {crisis} (betrifft {track})",
    votes: "Stimmen: {list}",
    noVotes: "niemand hat abgestimmt",
    decision: "Beschluss: {decision}",
    vetoDecision: "Veto von {nation}",
    noDecision: "keine Einigung, Krise trifft voll",
    cards: "Karten: {list}",
    none: "keine",
    blocked: "durch eine Blockade verpufft, ohne Wirkung",
    offers: "Angenommene Angebote: {list}",
    offersUnknownBuyer: "{list} (Käufer unbekannt)",
    accusation: "Misstrauensvotum: {text}",
    transfers: "Geheime Überweisungen zwischen den Nationen: {text}",
    transferredSum: "insgesamt {n} Einfluss (wer an wen, ist unbekannt – nicht spekulieren, wer)",
    accusedRight: "{nation} angeklagt, zu Recht – Maulwurf enttarnt",
    accusedWrong: "{nation} angeklagt, zu Unrecht",
    clock: "Uhr vorher {before}, nachher {after}; Krieg {krieg}/10, Autokratie {autokratie}/10, Kollaps {kollaps}/10",
    final: "SPIELENDE: {ending}. Sieger: {winners}. Held der Vernunft: {hero}. Brandstifter: {arsonist}. Schreibe eine finale Titelseite.",
    tomorrow: "Morgige Krise: {crisis}",
    earlier: "Frühere Tage:",
    earlierDay: "Tag {day}: {crisis}; Beschluss: {decision}; Karten: {cards}",
    test: "Antworte mit einer einzigen, absurd-dramatischen Schlagzeile auf Deutsch über eine Weltuntergangsuhr. Reiner Text, ohne Markdown.",
  },
};
