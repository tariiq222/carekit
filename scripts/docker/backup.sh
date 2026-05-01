#!/bin/bash
# Deqah Database Backup Script
# Runs pg_dump, encrypts with AES-256-CBC, and stores backups with rotation
# Requires: BACKUP_ENCRYPTION_KEY env var

set -euo pipefail

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_FILE="$BACKUP_DIR/deqah_${TIMESTAMP}.dump.enc"

# Fail fast if encryption key is not set
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required for encrypted backups}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# PostgreSQL backup — piped directly into openssl encryption (never written as plaintext)
echo "[$(date)] Starting PostgreSQL backup..."
PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-deqah}" \
  -d "${POSTGRES_DB:-deqah}" \
  --format=custom \
  --compress=9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass pass:"$BACKUP_ENCRYPTION_KEY" \
    -out "$BACKUP_FILE"

echo "[$(date)] PostgreSQL backup completed: deqah_${TIMESTAMP}.dump.enc"

# Clean old encrypted backups
find "$BACKUP_DIR" -name "*.dump.enc" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days"

# Log backup size
du -sh "$BACKUP_FILE"

echo "[$(date)] Backup process completed successfully"
