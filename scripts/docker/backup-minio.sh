#!/bin/sh
# Deqah MinIO Backup Script
# Mirrors the MinIO bucket, compresses and encrypts with AES-256-CBC, rotates old backups
# Runs in the minio/mc container
# Requires: BACKUP_ENCRYPTION_KEY env var

set -euo pipefail

BACKUP_DIR="/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ALIAS_NAME="deqah"
BUCKET_NAME="deqah"
MIRROR_DIR="$BACKUP_DIR/${BUCKET_NAME}_${TIMESTAMP}_tmp"
ARCHIVE="$BACKUP_DIR/${BUCKET_NAME}_${TIMESTAMP}.tar.gz.enc"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Fail fast if encryption key is not set
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required for encrypted backups}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

log "Starting MinIO backup..."

# Configure mc alias
log "Configuring MinIO Client alias..."
mc alias set "$ALIAS_NAME" \
  "${MINIO_ENDPOINT:-http://minio:9000}" \
  "$MINIO_ACCESS_KEY" \
  "$MINIO_SECRET_KEY" \
  --api S3v4

# Verify connection
if ! mc ls "$ALIAS_NAME/$BUCKET_NAME" > /dev/null 2>&1; then
  log "ERROR: Cannot access bucket $ALIAS_NAME/$BUCKET_NAME"
  log "Check MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY"
  exit 1
fi

# Mirror the bucket to a temporary directory
log "Mirroring bucket $BUCKET_NAME to temporary directory..."
mc mirror --quiet "$ALIAS_NAME/$BUCKET_NAME" "$MIRROR_DIR"

# Count mirrored files
FILE_COUNT=$(find "$MIRROR_DIR" -type f | wc -l)
log "Mirrored $FILE_COUNT files"

# Compress and encrypt — plaintext directory is removed after encryption
log "Compressing and encrypting backup..."
tar -czf - -C "$BACKUP_DIR" "$(basename "$MIRROR_DIR")" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass pass:"$BACKUP_ENCRYPTION_KEY" \
    -out "$ARCHIVE"

# Remove unencrypted mirror
rm -rf "$MIRROR_DIR"

# Log archive size
BACKUP_SIZE=$(du -sh "$ARCHIVE" | cut -f1)
log "Encrypted archive: $(basename "$ARCHIVE") ($BACKUP_SIZE)"

# Clean old encrypted backups
log "Cleaning backups older than $RETENTION_DAYS days..."
CLEANED=0
for f in "$BACKUP_DIR"/${BUCKET_NAME}_*.tar.gz.enc; do
  if [ -f "$f" ] && [ "$f" != "$ARCHIVE" ]; then
    file_age=$(find "$f" -maxdepth 0 -mtime +"$RETENTION_DAYS" 2>/dev/null)
    if [ -n "$file_age" ]; then
      rm -f "$f"
      CLEANED=$((CLEANED + 1))
      log "Removed old backup: $(basename "$f")"
    fi
  fi
done
log "Cleaned $CLEANED old backup(s)"

log "MinIO backup completed successfully"
