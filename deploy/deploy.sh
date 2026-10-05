#!/usr/bin/env bash
# Deploy-Skript auf dem Server. Wird von GitHub Actions über SSH aufgerufen.
#
# Jeder Schlüssel in ~/.ssh/authorized_keys ist auf genau eine Umgebung festgelegt:
#   restrict,command="/home/wire/fvz/deploy.sh staging" ssh-ed25519 AAAA… fvz-deploy-staging
#   restrict,command="/home/wire/fvz/deploy.sh prod"    ssh-ed25519 AAAA… fvz-deploy-prod
# Der Befehl kommt aus SSH_ORIGINAL_COMMAND:
#   deploy <commit>   diesen Commit bauen und starten (prod: nur Commits aus master, staging: aus einem Branch dieses Repos)
#   rollback          eine Version zurück
#   copy-data         (nur prod) Prod-Daten nach Staging kopieren, ohne Push-Abos
#   status            aktuelle Version und Verlauf zeigen
# Von Hand auf dem Server: ~/fvz/deploy.sh prod status
#
# Alles steht in main(), damit Bash das Skript vollständig liest, bevor es läuft.
set -euo pipefail

main() {
  local env="${1:-}"; shift || true
  local cmd="${SSH_ORIGINAL_COMMAND:-$*}"
  local base="${FVZ_HOME:-$HOME/fvz}"
  local action arg extra
  read -r action arg extra <<<"$cmd" || true

  case "$env" in staging|prod) ;; *) die "Umgebung muss staging oder prod sein" ;; esac
  [[ -z "${extra:-}" ]] || die "zu viele Angaben"
  local dir="$base/$env"
  [[ -d "$dir/.git" ]] || die "$dir ist kein Git-Verzeichnis"

  exec 9>"$base/.lock-$env"
  flock -w 900 9 || die "ein anderes Deployment läuft noch"

  case "$action" in
    deploy)    deploy "$env" "$dir" "${arg:-}" ;;
    rollback)  [[ -z "${arg:-}" ]] || die "rollback braucht keine Angabe"; rollback "$env" "$dir" "$base" ;;
    copy-data) [[ "$env" == prod ]] || die "copy-data nur mit dem Prod-Schlüssel"; copy_data "$base" ;;
    status)    status "$env" "$dir" "$base" ;;
    *) die "unbekannter Befehl: ${action:-leer} (erlaubt: deploy, rollback, copy-data, status)" ;;
  esac
}

die() { echo "FEHLER: $*" >&2; exit 1; }
log() { echo "[$(date '+%F %T')] $*"; }

history_file() { echo "$1/.history-$2"; }

deploy() {
  local env="$1" dir="$2" sha="$3"
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "Commit muss ein voller 40-stelliger Hash sein"
  git -C "$dir" fetch --quiet --prune origin
  git -C "$dir" cat-file -e "$sha^{commit}" 2>/dev/null || die "Commit $sha gibt es im Repo nicht"
  if [[ "$env" == prod ]]; then
    git -C "$dir" merge-base --is-ancestor "$sha" origin/master || die "Prod nimmt nur Commits aus master"
  else
    [[ -n "$(git -C "$dir" branch -r --contains "$sha")" ]] || die "Commit liegt auf keinem Branch dieses Repos"
  fi
  local prev; prev="$(git -C "$dir" rev-parse HEAD)"
  switch_to "$env" "$dir" "$sha" || {
    log "Neue Version startet nicht – zurück auf ${prev:0:7}"
    switch_to "$env" "$dir" "$prev" || true
    die "Deployment von ${sha:0:7} fehlgeschlagen, ${prev:0:7} läuft wieder"
  }
  echo "$(date -Is) $sha" >>"$(history_file "$(dirname "$dir")" "$env")"
  log "$env läuft jetzt mit ${sha:0:7}: $(git -C "$dir" log -1 --format=%s "$sha")"
}

rollback() {
  local env="$1" dir="$2" base="$3" hist
  hist="$(history_file "$base" "$env")"
  [[ -f "$hist" && "$(wc -l <"$hist")" -ge 2 ]] || die "keine frühere Version im Verlauf"
  local target; target="$(tail -n 2 "$hist" | head -n 1 | cut -d' ' -f2)"
  switch_to "$env" "$dir" "$target" || die "Zurückrollen auf ${target:0:7} fehlgeschlagen"
  sed -i '$ d' "$hist"   # letzte Version aus dem Verlauf nehmen; nächstes rollback geht noch einen Schritt zurück
  log "$env zurück auf ${target:0:7}: $(git -C "$dir" log -1 --format=%s "$target")"
}

# Commit auschecken, Container bauen und starten, prüfen, ob er antwortet.
switch_to() {
  local env="$1" dir="$2" sha="$3"
  [[ -z "$(git -C "$dir" status --porcelain --untracked-files=no)" ]] || die "in $dir wurden Dateien von Hand geändert – bitte erst aufräumen"
  git -C "$dir" checkout --quiet --detach "$sha"
  log "baue $env (${sha:0:7}) …"
  (cd "$dir" && docker compose up -d --build --quiet-pull 2>&1 | tail -n 5)
  healthy "$dir"
}

healthy() {
  local dir="$1" id
  for _ in $(seq 1 ${HEALTH_TRIES:-30}); do
    id="$(cd "$dir" && docker compose ps -q fvz 2>/dev/null || true)"
    if [[ -n "$id" ]] && docker exec "$id" node -e \
      "fetch('http://127.0.0.1:8080/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" 2>/dev/null; then
      return 0
    fi
    sleep ${HEALTH_SLEEP:-2}
  done
  echo "Container antwortet nicht. Letzte Log-Zeilen:" >&2
  (cd "$dir" && docker compose logs --tail 20 fvz >&2) || true
  return 1
}

# Prod-Datenbank als Momentaufnahme nach Staging. Push-Abos werden gelöscht,
# damit Staging keine echten Spieler benachrichtigt. Die alte Staging-Datenbank bleibt als fvz.sqlite.bak.
copy_data() {
  local base="$1" prod_id
  prod_id="$(cd "$base/prod" && docker compose ps -q fvz)"
  [[ -n "$prod_id" ]] || die "Prod läuft nicht"
  log "Momentaufnahme von Prod …"
  docker exec "$prod_id" node -e "
    const fs = require('node:fs'); const { DatabaseSync } = require('node:sqlite');
    fs.rmSync('/data/.export.sqlite', { force: true });
    new DatabaseSync('/data/fvz.sqlite').exec(\"VACUUM INTO '/data/.export.sqlite'\");"
  (cd "$base/staging" && docker compose stop fvz >/dev/null)
  local image; image="$(docker inspect --format '{{.Config.Image}}' "$prod_id")"
  docker run --rm --user 1000:1000 -v "$base/prod/data:/from" -v "$base/staging/data:/to" --entrypoint node "$image" -e "
    const fs = require('node:fs'); const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync('/from/.export.sqlite'); db.exec('DELETE FROM push_subs'); db.close();
    if (fs.existsSync('/to/fvz.sqlite')) fs.copyFileSync('/to/fvz.sqlite', '/to/fvz.sqlite.bak');
    for (const f of ['/to/fvz.sqlite-wal', '/to/fvz.sqlite-shm', '/to/fvz.sqlite-journal']) fs.rmSync(f, { force: true });
    fs.copyFileSync('/from/.export.sqlite', '/to/fvz.sqlite'); fs.rmSync('/from/.export.sqlite');"
  (cd "$base/staging" && docker compose start fvz >/dev/null)
  healthy "$base/staging" || die "Staging startet nach dem Kopieren nicht"
  log "Prod-Daten liegen jetzt auf Staging (ohne Push-Abos). Alte Staging-Daten: staging/data/fvz.sqlite.bak"
}

status() {
  local env="$1" dir="$2" base="$3" hist
  hist="$(history_file "$base" "$env")"
  echo "$env: $(git -C "$dir" log -1 --format='%h %s (%cr)')"
  [[ -f "$hist" ]] && { echo "Verlauf (neueste unten):"; tail -n 5 "$hist"; } || true
}

main "$@"
