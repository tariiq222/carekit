#!/bin/sh
# CareKit MinIO Backup Script
# Mirrors the MinIO bucket to local storage with rotation
# Runs in the minio/mc container

set -euo pipefail

BACKUP_DIR="/backups/minio"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
ALIAS_NAME="carekit"
BUCKET_NAME="carekit"
DEST_DIR="$BACKUP_DIR/${BUCKET_NAME}_${TIMESTAMP}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

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

# Mirror the bucket
log "Mirroring bucket $BUCKET_NAME to $DEST_DIR..."
mc mirror --quiet "$ALIAS_NAME/$BUCKET_NAME" "$DEST_DIR"

# Count backed up files
FILE_COUNT=$(find "$DEST_DIR" -type f | wc -l)
log "Mirrored $FILE_COUNT files to $DEST_DIR"

# Log backup size
BACKUP_SIZE=$(du -sh "$DEST_DIR" | cut -f1)
log "Backup size: $BACKUP_SIZE"

# Clean old backups
log "Cleaning backups older than $RETENTION_DAYS days..."
CLEANED=0
for dir in "$BACKUP_DIR"/${BUCKET_NAME}_*; do
  if [ -d "$dir" ] && [ "$dir" != "$DEST_DIR" ]; then
    dir_age=$(find "$dir" -maxdepth 0 -mtime +"$RETENTION_DAYS" 2>/dev/null)
    if [ -n "$dir_age" ]; then
      rm -rf "$dir"
      CLEANED=$((CLEANED + 1))
      log "Removed old backup: $(basename "$dir")"
    fi
  fi
done
log "Cleaned $CLEANED old backup(s)"

log "MinIO backup completed successfully"
