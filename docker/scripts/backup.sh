#!/bin/bash
# CareKit Database Backup Script
# Runs pg_dump and stores backups with rotation

set -euo pipefail

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# PostgreSQL backup
echo "[$(date)] Starting PostgreSQL backup..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-carekit}" \
  -d "${POSTGRES_DB:-carekit}" \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/carekit_${TIMESTAMP}.dump"

echo "[$(date)] PostgreSQL backup completed: carekit_${TIMESTAMP}.dump"

# Clean old PostgreSQL backups
find "$BACKUP_DIR" -name "*.dump" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days"

# Log backup size
du -sh "$BACKUP_DIR/carekit_${TIMESTAMP}.dump"

echo "[$(date)] Backup process completed successfully"
