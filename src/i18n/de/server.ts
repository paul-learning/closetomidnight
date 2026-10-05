// Texte, die nur der Server braucht: Fehlermeldungen und Push-Benachrichtigungen.
export const server = {
  errors: {
    gameOver: "Das Spiel ist vorbei.",
    needTarget: "Für diese Karte musst du ein Ziel wählen.",
    leakKnown: "Die Ziele dieses Spielers kennst du schon alle. Wähl jemand anderen.",
    cannotDefect: "Überlaufen ist gerade nicht erlaubt.",
    tooExpensive: "Dafür reicht dein Einfluss nicht.",
    badTransfer: "Diese Überweisung geht nicht. Wähl einen anderen Spieler und einen Betrag ab 1.",
    notEnoughFree: "So viel freien Einfluss hast du nicht. Was deine Karte und deine Ratsstimme kosten, bleibt reserviert.",
    resolving: "Der Tag wird gerade ausgewertet. Versuch es gleich noch einmal.",
    tooManyTransfers: "Für heute hast du genug überwiesen. Morgen wieder.",
    badLink: "Dieser Spieler-Link gilt nicht (mehr). Melde dich auf der Startseite mit deinem Passwort an.",
    badAdminLink: "Diesen Admin-Link gibt es nicht.",
    wrongSecret: "Das Admin-Passwort stimmt nicht.",
    tooManyAttempts: "Zu viele falsche Versuche. Versuch es in 15 Minuten noch einmal.",
    noSecret: "Auf dem Server ist kein ADMIN_SECRET gesetzt.",
    wrongPassword: "Das Passwort stimmt nicht.",
    noPassword: "Für dich gibt es noch kein Passwort. Frag die Spielleitung.",
    noGame: "Es läuft gerade kein Spiel.",
    cancelled: "Dieses Spiel wurde von der Spielleitung abgebrochen.",
    notLoggedIn: "Bitte melde dich als Spielleitung an.",
    cannotDelete: "Ein laufendes Spiel lässt sich nicht löschen. Brich es zuerst ab.",
    notFound: "Nicht gefunden.",
    badRequest: "Die Anfrage war ungültig.",
  },

  // ---- Push-Benachrichtigungen (ohne Geheimnisse) ----
  push: {
    title: "Der Weltuntergangs-Kurier",
    newEdition: "Tag {day}: Die neue Ausgabe ist da. Die Uhr steht auf {clock}.",
    gameOver: "Das Spiel ist vorbei: {ending}",
    reminder: "Noch {hours} Stunden bis {hour}:00. Du hast deinen Zug noch nicht festgelegt.",
    welcome: "Benachrichtigungen sind an. Wir melden uns, wenn die Welt brennt.",
    transfer: "{nation} hat dir {amount} Einfluss überwiesen.",
    transferSubject: "{nation} hat dir {amount} Einfluss überwiesen: „{subject}“",
  },
};
