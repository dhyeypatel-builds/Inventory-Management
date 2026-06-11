#!/usr/bin/env bash
#
# Nightly Postgres backup for TyreStock.
#
# Dumps the dockerised Postgres to a dated, compressed file and prunes old
# copies. Schedule on the host with cron, e.g. (02:30 every night):
#
#   30 2 * * * /opt/tyrestock/prod/deploy/backup.sh >> /var/log/tyrestock-backup.log 2>&1
#
# Restore procedure: see deploy/RUNBOOK.md.

set -euo pipefail

# ── Config (override via environment) ─────────────────────────────────────────
COMPOSE_PROJECT="${COMPOSE_PROJECT:-tyrestock}"     # -p value used at `docker compose up`
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-tyrestock}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tyrestock}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# Also back up tenant logo uploads (local storage transport).
UPLOADS_DIR="${UPLOADS_DIR:-}"

timestamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

container="$(docker compose -p "$COMPOSE_PROJECT" ps -q "$POSTGRES_SERVICE")"
if [[ -z "$container" ]]; then
  echo "ERROR: postgres container not found (project=$COMPOSE_PROJECT service=$POSTGRES_SERVICE)" >&2
  exit 1
fi

dump_file="$BACKUP_DIR/tyrestock-$timestamp.sql.gz"
docker exec "$container" pg_dump -U "$POSTGRES_USER" --clean --if-exists "$POSTGRES_DB" \
  | gzip > "$dump_file"
echo "DB backup written: $dump_file ($(du -h "$dump_file" | cut -f1))"

if [[ -n "$UPLOADS_DIR" && -d "$UPLOADS_DIR" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$timestamp.tar.gz" -C "$UPLOADS_DIR" .
  echo "Uploads backup written: $BACKUP_DIR/uploads-$timestamp.tar.gz"
fi

# Prune
find "$BACKUP_DIR" -name 'tyrestock-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Pruned backups older than $RETENTION_DAYS days"
