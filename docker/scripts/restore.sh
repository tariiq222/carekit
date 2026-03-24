#!/bin/bash
# CareKit Database Restore Script
# Usage: ./restore.sh <backup_file.dump>

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.dump>"
  echo "Available backups:"
  ls -lht /backups/postgres/*.dump 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[$(date)] WARNING: This will overwrite the current database!"
echo "Restoring from: $BACKUP_FILE"

PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  -h "${POSTGRES_HOST:-postgres}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-carekit}" \
  -d "${POSTGRES_DB:-carekit}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

echo "[$(date)] Restore completed successfully"
