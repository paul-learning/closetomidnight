# Deployment einmalig einrichten

So läuft es danach:

- **Pull Request** (aus diesem Repo) → Tests → bei Grün automatisch auf **game-staging**. Jeder neue Push auf den PR deployt erneut. Bei mehreren offenen PRs gewinnt der zuletzt gepushte.
- **Merge auf master** → Tests → automatisch auf **game** (Produktion).
- **Actions → „Betrieb“ → „Run workflow“** (von master aus): Branch auf Staging, eine Version zurück (Staging oder Prod), Prod-Daten nach Staging kopieren, Status anzeigen.
- Startet eine neue Prod-Version nicht, setzt der Server von selbst die vorige wieder in Gang.

Sicherheit:

- Zwei Schlüssel: einer darf nur Staging, einer nur Prod. Das legt der Server fest (`authorized_keys`), nicht GitHub.
- Der Prod-Schlüssel liegt in der GitHub-Umgebung `production`, die nur master benutzen darf. Wer Branches pushen darf, kommt damit trotzdem nicht an Prod.
- Der Server nimmt für Prod nur Commits aus master und für Staging nur Commits, die auf einem Branch dieses Repos liegen. Forks kommen nicht durch.
- Der Schlüssel kann nur `deploy.sh` aufrufen: keine Shell, keine Weiterleitungen.

## 1. Auf dem Server (SSH)

Am Stück kopieren. Setzt voraus, dass `~/fvz/prod` und `~/fvz/staging` Git-Klone dieses Repos sind.

```bash
# Prüfen: Git-Klone, Docker ohne sudo
git -C ~/fvz/prod remote get-url origin && git -C ~/fvz/staging remote get-url origin && docker ps >/dev/null && echo "OK"

# Deploy-Skript installieren (liegt bewusst außerhalb der Klone)
git -C ~/fvz/prod fetch -q origin
git -C ~/fvz/prod show origin/master:deploy/deploy.sh > ~/fvz/deploy.sh 2>/dev/null \
  || git -C ~/fvz/prod show origin/ci-pipeline:deploy/deploy.sh > ~/fvz/deploy.sh
chmod 700 ~/fvz/deploy.sh

# Zwei Schlüssel: einer nur für Staging, einer nur für Prod
ssh-keygen -q -t ed25519 -N "" -C fvz-deploy-staging -f ~/fvz-deploy-staging
ssh-keygen -q -t ed25519 -N "" -C fvz-deploy-prod -f ~/fvz-deploy-prod
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo "restrict,command=\"$HOME/fvz/deploy.sh staging\" $(cat ~/fvz-deploy-staging.pub)" >> ~/.ssh/authorized_keys
echo "restrict,command=\"$HOME/fvz/deploy.sh prod\" $(cat ~/fvz-deploy-prod.pub)" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Test: beide sollten "staging: …" bzw. "prod: …" zeigen (beim ersten Mal "yes" tippen)
ssh -i ~/fvz-deploy-staging -o IdentitiesOnly=yes localhost status
ssh -i ~/fvz-deploy-prod -o IdentitiesOnly=yes localhost status
```

Dann die Werte für GitHub anzeigen:

```bash
echo "DEPLOY_USER:"; whoami
echo "DEPLOY_KNOWN_HOSTS:"; ssh-keyscan -t ed25519 game.paulsplaygroundvm.de 2>/dev/null
echo "DEPLOY_KEY für staging:"; cat ~/fvz-deploy-staging
echo "DEPLOY_KEY für production:"; cat ~/fvz-deploy-prod
```

Wenn alles in GitHub eingetragen ist, die privaten Schlüssel vom Server löschen:

```bash
rm ~/fvz-deploy-staging ~/fvz-deploy-prod
```

## 2. In GitHub (Repo → Settings)

1. **Environments → New environment → `staging`** → „Add environment secret“: `DEPLOY_KEY` = der Staging-Schlüssel (ganzer Block inkl. `-----BEGIN…` und `-----END…`).
   Optional: „Required reviewers“ = du. Dann wartet jedes Staging-Deployment auf deinen Klick.
2. **Environments → New environment → `production`**
   - „Deployment branches and tags“ → „Selected branches and tags“ → `master` hinzufügen.
   - Secret `DEPLOY_KEY` = der Prod-Schlüssel.
3. **Secrets and variables → Actions → Reiter „Variables“ → New repository variable**, dreimal:
   - `DEPLOY_HOST` = `game.paulsplaygroundvm.de`
   - `DEPLOY_USER` = Ausgabe von `whoami`
   - `DEPLOY_KNOWN_HOSTS` = die Zeile von `ssh-keyscan`
4. **Rules → Rulesets → dein master-Ruleset** → „Require status checks to pass“ → `tests` hinzufügen. Der Check taucht in der Auswahl erst auf, nachdem er einmal gelaufen ist, also nach dem ersten PR.
5. **Actions → General → „Fork pull request workflows from outside collaborators“** → „Require approval for all outside collaborators“.

## Wenn das Skript sich ändert

`deploy.sh` läuft aus `~/fvz/deploy.sh`, nicht aus dem Klon. Ändert ein PR `deploy/deploy.sh`, nach dem Merge einmal neu installieren:

```bash
git -C ~/fvz/prod fetch -q origin && git -C ~/fvz/prod show origin/master:deploy/deploy.sh > ~/fvz/deploy.sh
```

Von Hand auf dem Server geht auch: `~/fvz/deploy.sh prod status`.
