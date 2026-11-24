#!/bin/sh
set -eu
umask 077
cd "$(dirname "$0")/.."
dest="${1:-/opt/backups/onlymarket}"
mkdir -p "$dest"
name="$dest/onlymarket-$(date -u +%Y%m%dT%H%M%SZ)-$$.dump"
tmp="$name.tmp"
trap 'rm -f "$tmp"' EXIT HUP INT TERM
docker compose exec -T db pg_dump -U onlymarket -d onlymarket -Fc > "$tmp"
test -s "$tmp"
docker compose exec -T db pg_restore -l < "$tmp" >/dev/null
mv "$tmp" "$name"
printf '%s\n' "$name"
