#!/bin/bash
# CareKit Database Restore Script
# Usage: ./restore.sh <backup_file.dump.enc>
# Requires: BACKUP_ENCRYPTION_KEY env var (same key used during backup)

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.dump.enc>"
  echo "Available backups:"
  ls -lht /backups/postgres/*.dump.enc 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required to decrypt the backup}"

echo "[$(date)] WARNING: This will overwrite the current database!"
echo "Restoring from: $BACKUP_FILE"

# Decrypt on the fly and pipe directly to pg_restore
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -pass pass:"$BACKUP_ENCRYPTION_KEY" \
  -in "$BACKUP_FILE" \
  | PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
    -h "${POSTGRES_HOST:-postgres}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER:-carekit}" \
    -d "${POSTGRES_DB:-carekit}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges

echo "[$(date)] Restore completed successfully"
