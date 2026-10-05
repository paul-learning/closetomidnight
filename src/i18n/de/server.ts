// Texte, die nur der Server braucht: Fehlermeldungen und Push-Benachrichtigungen.
export const server = {
  errors: {
    gameOver: "Das Spiel ist vorbei.",
    needTarget: "Für diese Karte musst du ein Ziel wählen.",
    cannotDefect: "Überlaufen ist gerade nicht erlaubt.",
    tooExpensive: "Dafür reicht dein Einfluss nicht.",
    badLink: "Dieser Spieler-Link gilt nicht (mehr). Melde dich auf der Startseite mit deinem Passwort an.",
    badAdminLink: "Diesen Admin-Link gibt es nicht.",
    wrongSecret: "Das Admin-Passwort stimmt nicht.",
    tooManyAttempts: "Zu viele falsche Versuche. Versuch es in 15 Minuten noch einmal.",
    noSecret: "Auf dem Server ist kein ADMIN_SECRET gesetzt.",
    wrongPassword: "Das Passwort stimmt nicht.",
    noPassword: "Für dich gibt es noch kein Passwort. Frag die Spielleitung.",
    noGame: "Es läuft gerade kein Spiel.",
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
  },
};
