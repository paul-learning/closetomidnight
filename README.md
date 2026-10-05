# Fünf vor Zwölf

Ein satirisches Diplomatie-Spiel für vier Personen, eine Woche lang, ein Zug pro Tag. Die Welt steuert auf Mitternacht zu, und ihr seid die Einzigen, die sie aufhalten können – wenn ihr euch nicht gegenseitig über den Tisch zieht.

Keine Laufzeit-Pakete: Node 22.18+, eingebautes SQLite, schlichtes HTML/CSS/JS.

## Lokal starten

1. `.env.example` nach `.env` kopieren (für den Test reicht `ADMIN_SECRET=test`).
2. `npm start` – oder in VS Code: „Ausführen und Debuggen“ → „Spiel starten“ (F5).
3. http://localhost:8080 öffnen, Admin-Passwort eingeben, Spiel anlegen.

- `npm test` – Selbsttests (Texte vollständig, Engine deterministisch, Zugprüfung, Push-Verschlüsselung gegen RFC 8291)
- `npm run simulate` – Balance-Simulator mit Bots
- `npm run check` – TypeScript-Typprüfung (braucht `npm install`)

## Deployment

- Pull Request → Tests → automatisch auf Staging (game-staging…).
- Merge auf master → Tests → automatisch auf Produktion.
- Zurückrollen, Prod-Daten nach Staging kopieren usw.: Actions → „Betrieb“ → „Run workflow“.

Einmalige Einrichtung (Server und GitHub): [`deploy/EINRICHTEN.md`](deploy/EINRICHTEN.md).

## Auf dem Server von Hand (Docker)

```bash
git clone <repo> fvz && cd fvz
cp .env.example .env    # ADMIN_SECRET und BASE_URL setzen
mkdir -p data && sudo chown 1000:1000 data   # das Spiel läuft im Container als Benutzer "node" (UID 1000)
docker compose up -d --build
```

Mit Caddy davor:

```
fvz.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

Die Datenbank liegt in `./data/fvz.sqlite`.

**Bestehende Installation aktualisieren:** Früher lief der Container als root, die Dateien in `data/` gehören deshalb root. Einmalig vor dem Neustart: `sudo chown -R 1000:1000 data`, dann `docker compose up -d --build`.

Auf dem Server außerdem:

- In `.env`: ein langes, zufälliges `ADMIN_SECRET` (z. B. `openssl rand -base64 24`), `BASE_URL` mit https und `TRUST_PROXY=1`.
- `chmod 600 .env` – nur du darfst die Schlüssel lesen.
- Schlüssel tauschen: `.env` ändern, dann `docker compose up -d`.
- Nach zehn falschen Passwörtern (Spieler oder Admin) ist die Adresse für 15 Minuten gesperrt.
- Sicherung, z. B. nächtlich per cron: `sqlite3 data/fvz.sqlite ".backup data/backup-$(date +%F).sqlite"`
- Ob die KI-Zeitung funktioniert und wie viele Spieler Benachrichtigungen aktiviert haben, zeigt die Spielleitung unter „Verbindungen“.

## Spiele verwalten

1. `BASE_URL` öffnen, „Spielleitung“ wählen, Admin-Passwort eingeben. Du landest in der **Verwaltung** (`/admin`). Das Gerät bleibt 30 Tage angemeldet („Abmelden“ oben rechts beendet das).
2. Dort unter „Neues Spiel anlegen“ die vier Namen eingeben. Läuft noch ein Spiel, wird es dabei abgebrochen – es läuft immer nur eins.
3. „Öffnen“ führt zur Seite des Spiels. Dort für jeden Spieler „Neues Passwort“ drücken und es ihm schicken. Es wird nur einmal angezeigt.
   „Passwort erneuern“ sperrt jemanden aus: neues Passwort **und** neuer Link, angemeldete Geräte müssen sich neu anmelden, seine Benachrichtigungen werden abgeschaltet.
4. Die Spieler öffnen `BASE_URL`, wählen ihre Nation und geben ihr Passwort ein. Das Gerät merkt sich die Anmeldung. Die geheimen Links (`/p/…`, `/a/…`) funktionieren weiterhin.
5. Jeden Abend um 21:00 wird der Tag aufgelöst. Haben alle festgelegt, kannst du auf der Seite des Spiels früher auflösen. „Fehlende Züge spielt ein Bot“ ist praktisch zum Alleine-Testen.
6. In der Verwaltung hat jedes Spiel:
   - **Spiel abbrechen** (nur laufende): sofort Schluss, keine Auflösung, keine Erinnerungen, keine Züge mehr; die Zeitung bleibt lesbar.
   - **Verlauf exportieren**: eine Textdatei (Markdown) mit dem ganzen Spiel Tag für Tag, inklusive der geheimen Züge, der Zeitungen und des Ergebnisses.
   - **Löschen** (nur beendete oder abgebrochene): entfernt das Spiel samt Spielern, Zügen, Zeitungen und Benachrichtigungen endgültig. Vorher exportieren, wenn du es behalten willst.

Die Startseite zeigt das zuletzt angelegte Spiel (ohne Anmeldung nur Nationen und Spieltag, keine Namen); ist es abgebrochen, bietet sie nur die Anmeldung der Spielleitung an. Ein beendetes Spiel bleibt für die Spieler sichtbar, bis du es löschst – so sehen alle das Ergebnis und wer der Brandstifter war. Passwörter liegen nur als Hash (scrypt) in der Datenbank, die Anmeldung der Spielleitung als Hash im Cookie-Speicher. Nach zehn falschen Passwörtern ist die Adresse für 15 Minuten gesperrt.

## Benachrichtigungen und Zeitung teilen

- **Push-Benachrichtigungen:** Jeder Spieler kann sie auf seiner Seite aktivieren. Es kommt eine Nachricht, wenn die neue Zeitung erscheint, und um 18:00 eine Erinnerung an alle, die noch nicht festgelegt haben. Die Schlüssel dafür erzeugt der Server beim ersten Start selbst und speichert sie in der Datenbank.
- **iPhone:** Benachrichtigungen gehen erst, wenn das Spiel über Teilen → „Zum Home-Bildschirm“ hinzugefügt und von dort geöffnet wurde. Die Seite zeigt dazu einen Hinweis.
- **Push braucht HTTPS** (auf dem Server über Caddy; lokal reicht `localhost`).
- **Zeitung teilen:** In der Spielleitung gibt es pro Ausgabe „Tag N als Bild teilen“. Das Bild wird auf dem Handy erzeugt und über das Teilen-Menü verschickt, z. B. in eure Signal-Gruppe. Am Computer wird es heruntergeladen.

## KI-Zeitung (optional)

`MISTRAL_API_KEY` in `.env` setzen. Die KI schreibt nur den Text; alle Zahlen kommen aus der Regel-Engine. Ohne Schlüssel oder bei Fehlern erscheint eine schlichte Zusammenfassung.

## Aufbau

Jede Datei hat eine Aufgabe. Abhängigkeiten zeigen nur nach unten: `http → game → engine → rules`.

| Ordner / Datei | Aufgabe |
| --- | --- |
| `src/config.ts` | Einstellungen und Zugangsdaten. Einzige Stelle, die `process.env` liest. |
| `src/rules/` | Statische Regeln: `types.ts`, `balance.ts` (Stellschrauben), `nations.ts` (Sonderfähigkeiten als Daten), `content.ts` (Krisen, Karten, Angebote, Ziele – nur IDs und Zahlen). |
| `src/i18n/` | Alle sichtbaren Texte. `de/content.ts` (Inhaltsnamen), `de/client.ts` (Oberfläche), `de/newspaper.ts` (Zeitung, KI-Auftrag), `de/server.ts` (Fehler, Benachrichtigungen). |
| `src/engine/` | Reine Spiellogik, kein Text, keine Datenbank, kein Netz. `state.ts` (Zustand, Abfragen), `setup.ts` (Spielstart, Angebote austeilen), `phases.ts` (Phasen eines Tages), `resolve.ts` (Ablauf eines Tages), `scoring.ts` (Spielende), `validate.ts` (Zugprüfung), `index.ts` (einzige Schnittstelle nach außen). |
| `src/bots/` | Bot-Spieler (Simulator und Ersatz für fehlende Züge). |
| `src/game/` | Spielbetrieb: `store.ts` (SQLite, einziges SQL), `registration.ts` (Spiele anlegen, Links, Admin-Passwort), `login.ts` (Startseite: Anmeldung, Passwort erneuern), `adminSession.ts` (Anmeldung der Spielleitung), `history.ts` (Verlauf exportieren), `passwords.ts` (Passwörter erzeugen und prüfen), `service.ts` (Züge, Auflösung, Einstellungen), `view.ts` (wer was sehen darf), `notifications.ts` (wer wann benachrichtigt wird), `scheduler.ts`, `time.ts`. |
| `src/newspaper/` | Zeitung: `summary.ts` (ohne KI), `prompt.ts` (Auftrag an die KI), `paper.ts` (entscheidet, welche Variante). |
| `src/integrations/` | Außenwelt: `mistral.ts`, `push/` (Web-Push: `crypto.ts` Verschlüsselung und Signatur nach RFC 8291/8292, `send.ts` Versand). |
| `src/http/` | `server.ts` (Routing, Fehler), `routes/` (eine Datei je Bereich), `respond.ts`, `static.ts`, `rateLimit.ts`. |
| `src/main.ts` | Startpunkt. |
| `.github/` | `workflows/ci.yml` (Tests, Staging bei PRs, Prod bei master), `workflows/ops.yml` (Handgriffe per Knopf), `actions/ssh-deploy/` (Befehl an den Server). |
| `deploy/` | `deploy.sh` (läuft auf dem Server), `EINRICHTEN.md`. |
| `src/tools/` | `simulate.ts`, `selftest.ts`, `pushtest.ts`. |
| `public/` | Oberfläche: `index.html`, `css/app.css`, `js/player.js` mit `js/player/` (Schritte, Reiter, Einführung), `js/admin.js` mit `js/admin/frontpage.js` (Zeitung als Bild) und `js/admin/overview.js` (Verwaltung aller Spiele), `js/start.js`, gemeinsame Helfer; `sw.js` (Service Worker für Benachrichtigungen), `manifest.webmanifest`, `icons/`. Texte kommen über `/strings.js` aus `src/i18n`. |

Typische Änderungen:

- **Zahlen tunen:** `src/rules/balance.ts`, dann `npm run simulate`.
- **Neue Krise oder Karte:** Zahlen in `src/rules/content.ts`, Namen in `src/i18n/de/content.ts`. `npm test` meldet fehlende Texte.
- **Texte ändern:** nur `src/i18n/de/`.
- **Neue Sonderfähigkeit:** Feld in `src/rules/nations.ts`, Abfrage in `src/engine/state.ts`.
