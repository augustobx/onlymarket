#!/bin/sh
# Run manually on the dedicated server, from an existing clean checkout.
set -eu
cd "$(dirname "$0")/.."
test "$(pwd -P)" = /opt/apps/onlymarket || { echo "Ruta esperada: /opt/apps/onlymarket"; exit 1; }
test -z "$(git status --porcelain)" || { echo "Checkout con cambios, abortado"; exit 1; }
sha="${1:-}"
test "${#sha}" = 40 || { echo "Indicar SHA completo con CI verde"; exit 1; }
test "$(git rev-parse HEAD)" = "$sha" || { echo "Checkout no coincide con SHA aprobado"; exit 1; }
test "${ONLYMARKET_CI_APPROVED:-}" = "$sha" || { echo "Verificar CI manualmente y confirmar SHA mediante ONLYMARKET_CI_APPROVED"; exit 1; }
test -f .env || { echo "Falta .env privado"; exit 1; }
docker network inspect proxy >/dev/null
docker compose config -q
docker compose up -d --wait db
docker compose build app
# Back up even a newly provisioned database, before migrations.
sh scripts/backup.sh /opt/backups/onlymarket
# Maintenance window for schema changes; no other compose projects are touched.
docker compose stop app
docker compose run --rm app npm run db:deploy
docker compose up -d --wait app
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log).catch(()=>process.exit(1))"
docker compose ps
echo "Instalación de revisión terminada. Configurar HTTPS y validar operaciones antes de habilitar al cliente."
