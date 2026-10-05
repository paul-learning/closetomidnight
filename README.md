# Fünf vor Zwölf

Ein satirisches Diplomatie-Spiel für vier Personen, eine Woche lang, ein Zug pro Tag. Die Welt steuert auf Mitternacht zu, und ihr seid die Einzigen, die sie aufhalten können – wenn ihr euch nicht gegenseitig über den Tisch zieht.

Keine Laufzeit-Pakete: Node 22.18+, eingebautes SQLite, schlichtes HTML/CSS/JS.

## Lokal starten

1. `.env.example` nach `.env` kopieren (für den Test reicht `ADMIN_SECRET=test`).
2. `npm start` – oder in VS Code: „Ausführen und Debuggen“ → „Spiel starten“ (F5).
3. http://localhost:8080 öffnen, „Spielleitung“ wählen, Admin-Passwort eingeben, in der Verwaltung ein Spiel anlegen.

- `npm test` – alle Tests: Regeln und Engine (`selftest`), Web-Push gegen RFC 8291 (`pushtest`), Spielbetrieb mit Datenbank (`gametest`), alte Datenbanken (`migrationtest`), KI-Anbindung gegen einen nachgebauten Anbieter (`aitest`)
- `npm run simulate` – Balance-Simulator mit Bots
- `npm run check` – TypeScript-Typprüfung (braucht `npm install`)

## Deployment

- Pull Request → Tests → automatisch auf Staging (game-staging…).
- Merge auf master → Tests → automatisch auf Produktion.
- Branch auf Staging, eine Version zurück (Staging oder Prod), Prod-Daten nach Staging kopieren, Status: Actions → „Betrieb“ → „Run workflow“.
- Startet eine neue Version nicht, setzt der Server von selbst die vorige wieder in Gang.

Auf dem Server liegen `~/fvz/prod` und `~/fvz/staging` (Git-Klone, je mit eigener `.env` und `compose.server.yml`, nicht im Repo) und `~/fvz/deploy.sh`. GitHub erreicht den Server nur über zwei SSH-Schlüssel, die jeweils auf eine Umgebung festgelegt sind und nur `deploy.sh` aufrufen dürfen.

**Wichtig:** Die `.env` in `~/fvz/prod` und `~/fvz/staging` enthält `COMPOSE_FILE=compose.server.yml`. Beim Bearbeiten nicht entfernen – sonst nimmt `docker compose` die `docker-compose.yml` aus dem Repo, und Caddy erreicht das Spiel nicht mehr.

Von Hand auf dem Server: `~/fvz/deploy.sh prod status` (bzw. `staging`, `rollback`).

**Ändert sich `deploy/deploy.sh`**, nach dem Merge einmal auf dem Server neu installieren (es läuft nicht aus dem Klon). Erst in eine neue Datei schreiben, damit bei einem Fehler nicht eine leere `deploy.sh` übrig bleibt:

```bash
git -C ~/fvz/prod fetch -q origin \
  && git -C ~/fvz/prod show origin/master:deploy/deploy.sh > ~/fvz/deploy.sh.new \
  && chmod 700 ~/fvz/deploy.sh.new && mv ~/fvz/deploy.sh.new ~/fvz/deploy.sh
```

Server oder GitHub neu einrichten: die Anleitung von damals steht im Git-Verlauf, [`deploy/EINRICHTEN.md` @ 93a7ae6](https://github.com/paul-learning/closetomidnight/blob/93a7ae6/deploy/EINRICHTEN.md).

## Ohne CI betreiben (Docker)

Für eine einzelne Installation ohne Staging reicht die `docker-compose.yml` aus dem Repo:

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

## Auf dem Server

Die Befehle hier laufen im Verzeichnis der Installation, auf dem CI-Server also in `~/fvz/prod` (bzw. `~/fvz/staging`).

- In `.env`: ein langes, zufälliges `ADMIN_SECRET` (z. B. `openssl rand -base64 24`), `BASE_URL` mit https und `TRUST_PROXY=1`.
- `chmod 600 .env` – nur du darfst die Schlüssel lesen.
- Schlüssel tauschen: `.env` ändern, dann `docker compose up -d`. Ein neues `ADMIN_SECRET` meldet die Spielleitung überall ab.
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

Die Startseite zeigt das zuletzt angelegte Spiel (ohne Anmeldung nur Nationen und Spieltag, keine Namen); ist es abgebrochen, bietet sie nur die Anmeldung der Spielleitung an. Ein beendetes Spiel bleibt für die Spieler sichtbar, bis du es löschst – so sehen alle das Ergebnis und wer der Brandstifter war. Passwörter liegen nur als Hash (scrypt) in der Datenbank; von der Anmeldung der Spielleitung kennt die Datenbank ebenfalls nur einen Hash, der Wert selbst steht im Cookie.

## Benachrichtigungen und Zeitung teilen

- **Push-Benachrichtigungen:** Jeder Spieler kann sie auf seiner Seite aktivieren. Es kommt eine Nachricht, wenn die neue Zeitung erscheint, und um 18:00 eine Erinnerung an alle, die noch nicht festgelegt haben. Die Schlüssel dafür erzeugt der Server beim ersten Start selbst und speichert sie in der Datenbank.
- **iPhone:** Benachrichtigungen gehen erst, wenn das Spiel über Teilen → „Zum Home-Bildschirm“ hinzugefügt und von dort geöffnet wurde. Die Seite zeigt dazu einen Hinweis.
- **Push braucht HTTPS** (auf dem Server über Caddy; lokal reicht `localhost`).
- **Zeitung teilen:** In der Spielleitung gibt es pro Ausgabe „Tag N als Bild teilen“. Das Bild wird auf dem Handy erzeugt und über das Teilen-Menü verschickt, z. B. in eure Signal-Gruppe. Am Computer wird es heruntergeladen.

## KI-Zeitung (optional)

Die KI schreibt nur den Text; alle Zahlen kommen aus der Regel-Engine. Ohne KI oder bei Fehlern erscheint eine schlichte Zusammenfassung. Angebunden wird jeder Anbieter mit OpenAI-kompatibler Schnittstelle. In `.env`:

```
AI_PROVIDER=gemini
AI_API_KEY=…
```

| `AI_PROVIDER` | Schlüssel | Standardmodell | Hinweis |
| --- | --- | --- | --- |
| `gemini` | kostenlos über [Google AI Studio](https://aistudio.google.com) | `gemini-3.5-flash-lite` | Gratis-Kontingent reicht für eine Zeitung pro Tag bei Weitem; Google darf Gratis-Anfragen zum Training nutzen (hier nur Spielereignisse). Flash-Lite, weil das neueste Flash im Gratis-Kontingent oft überlastet ist (503); mehr Witz mit `AI_MODEL=gemini-3.8-flash`. Feste Version statt `gemini-flash-latest`, damit sich das Verhalten nicht ohne Deploy ändert. |
| `mistral` | console.mistral.ai | `mistral-small-latest` | |
| `groq` | console.groq.com | `llama-3.3-70b-versatile` | |
| `openrouter` | openrouter.ai | – (`AI_MODEL` setzen) | |
| `ollama` | keiner | – (`AI_MODEL` setzen) | lokales Modell. Im Docker-Container ist `localhost` der Container selbst: `AI_BASE_URL` auf den Rechner mit Ollama setzen, z. B. `http://ollama:11434/v1`, wenn Ollama als Container im selben Docker-Netz läuft. |

`AI_MODEL` wählt ein anderes Modell, `AI_BASE_URL` eine andere Adresse. Ob es klappt, zeigt die Spielleitung unter „Verbindungen“ → „KI testen“; fehlt etwas, steht dort, was.

- Bei vorübergehenden Fehlern (Überlastung, Kontingent, Zeitüberschreitung) fragt der Server nach 10 Sekunden ein zweites Mal. Klappt es dann auch nicht, erscheint die schlichte Zusammenfassung – der Tag wird in jedem Fall aufgelöst.
- Alte Einstellungen mit nur `MISTRAL_API_KEY` / `MISTRAL_MODEL` funktionieren weiter. Sobald eine `AI_…`-Einstellung gesetzt ist, gelten die alten Werte nur noch, wenn `AI_PROVIDER=mistral` ist.

## Aufbau

Jede Datei hat eine Aufgabe. Abhängigkeiten zeigen nur nach unten: `http → game → engine → rules`.

| Ordner / Datei | Aufgabe |
| --- | --- |
| `src/config.ts` | Einstellungen und Zugangsdaten. Einzige Stelle, die `process.env` liest. |
| `src/rules/` | Statische Regeln: `types.ts`, `balance.ts` (Stellschrauben), `nations.ts` (Sonderfähigkeiten als Daten), `content.ts` (Krisen, Karten, Angebote, Ziele – nur IDs und Zahlen). |
| `src/i18n/` | Alle sichtbaren Texte. `de/content.ts` (Inhaltsnamen), `de/client.ts` (Oberfläche), `de/newspaper.ts` (Zeitung, KI-Auftrag), `de/server.ts` (Fehler, Benachrichtigungen), `de/history.ts` (Verlauf-Export). |
| `src/engine/` | Reine Spiellogik, kein Text, keine Datenbank, kein Netz. `state.ts` (Zustand, Abfragen), `setup.ts` (Spielstart, Angebote austeilen), `phases.ts` (Phasen eines Tages), `resolve.ts` (Ablauf eines Tages), `scoring.ts` (Spielende), `validate.ts` (Zugprüfung), `index.ts` (einzige Schnittstelle nach außen). |
| `src/bots/` | Bot-Spieler (Simulator und Ersatz für fehlende Züge). |
| `src/game/` | Spielbetrieb: `store.ts` (SQLite, einziges SQL), `registration.ts` (Spiele anlegen, Links, Admin-Passwort), `login.ts` (Startseite: Anmeldung, Passwort erneuern), `adminSession.ts` (Anmeldung der Spielleitung), `history.ts` (Verlauf exportieren), `passwords.ts` (Passwörter erzeugen und prüfen), `service.ts` (Züge, Auflösung, Einstellungen), `view.ts` (wer was sehen darf), `notifications.ts` (wer wann benachrichtigt wird), `scheduler.ts`, `time.ts`. |
| `src/newspaper/` | Zeitung: `summary.ts` (ohne KI), `prompt.ts` (Auftrag an die KI), `paper.ts` (entscheidet, welche Variante). |
| `src/integrations/` | Außenwelt: `ai.ts` (KI über OpenAI-kompatible Schnittstelle), `aiProviders.ts` (Voreinstellungen je Anbieter), `push/` (Web-Push: `crypto.ts` Verschlüsselung und Signatur nach RFC 8291/8292, `send.ts` Versand). |
| `src/http/` | `server.ts` (Routing, Fehler), `routes/` (`login.ts` Startseite, `player.ts` Spielerseite, `admin.ts` Seite eines Spiels, `adminArea.ts` Verwaltung), `respond.ts`, `static.ts`, `rateLimit.ts`, `cookies.ts`. |
| `src/main.ts` | Startpunkt. |
| `.github/` | `workflows/ci.yml` (Tests, Staging bei PRs, Prod bei master), `workflows/ops.yml` (Handgriffe per Knopf), `actions/ssh-deploy/` (Befehl an den Server). |
| `deploy/` | `deploy.sh` (läuft auf dem Server). |
| `src/tools/` | `simulate.ts` (Balance), Tests: `selftest.ts`, `pushtest.ts`, `gametest.ts`, `migrationtest.ts`, `aitest.ts`. |
| `public/` | Oberfläche: `index.html`, `css/app.css`, `js/player.js` mit `js/player/` (Schritte, Reiter, Einführung), `js/admin.js` mit `js/admin/frontpage.js` (Zeitung als Bild) und `js/admin/overview.js` (Verwaltung aller Spiele), `js/start.js`, gemeinsame Helfer; `sw.js` (Service Worker für Benachrichtigungen), `manifest.webmanifest`, `icons/`. Texte kommen über `/strings.js` aus `src/i18n`. |

Typische Änderungen:

- **Zahlen tunen:** `src/rules/balance.ts`, dann `npm run simulate`.
- **Neue Krise oder Karte:** Zahlen in `src/rules/content.ts`, Namen in `src/i18n/de/content.ts`. `npm test` meldet fehlende Texte.
- **Texte ändern:** nur `src/i18n/de/`.
- **Neue Sonderfähigkeit:** Feld in `src/rules/nations.ts`, Abfrage in `src/engine/state.ts`.
