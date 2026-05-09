#!/usr/bin/env bash
# P2.E — Offsite encrypted Postgres backup
#
# Usage:
#   BACKUP_S3_BUCKET=... BACKUP_S3_ENDPOINT=... BACKUP_S3_ACCESS_KEY=... \
#   BACKUP_S3_SECRET_KEY=... BACKUP_GPG_RECIPIENT=ops@deqah.app \
#   ./scripts/ops/backup-postgres-offsite.sh
#
# What it does:
#   1. pg_dump -Fc (custom format) of the production DB.
#   2. Encrypts the dump with GPG (public key of BACKUP_GPG_RECIPIENT).
#   3. Uploads to S3-compatible offsite bucket (Cloudflare R2 / Backblaze B2).
#   4. Retains last 30 days locally + last 90 days on offsite.
#
# Designed to run from the postgres container or a sidecar with pg_dump access.
# Offsite credentials and GPG public key MUST be provisioned before first run.

set -euo pipefail

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER missing}"
: "${POSTGRES_DB:?POSTGRES_DB missing}"
: "${PGPASSWORD:?PGPASSWORD missing}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET missing}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT missing — e.g. https://<account>.r2.cloudflarestorage.com}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY missing}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY missing}"
: "${BACKUP_GPG_RECIPIENT:?BACKUP_GPG_RECIPIENT missing}"
: "${LOCAL_RETENTION_DAYS:=30}"

WORKDIR="${BACKUP_WORKDIR:-/var/backups/deqah}"
mkdir -p "$WORKDIR"

STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$WORKDIR/deqah-$STAMP.dump"
ENCRYPTED="$DUMP.gpg"

echo "[backup] pg_dump → $DUMP"
pg_dump \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --format=custom \
  --no-owner --no-privileges \
  --file="$DUMP"

DUMP_BYTES=$(stat -c%s "$DUMP" 2>/dev/null || stat -f%z "$DUMP")
echo "[backup] dump size: $DUMP_BYTES bytes"
if [[ "$DUMP_BYTES" -lt 1024 ]]; then
  echo "[backup] FATAL — dump under 1KB, aborting"; exit 1
fi

echo "[backup] gpg encrypt → $ENCRYPTED"
gpg --batch --yes --trust-model always \
  --recipient "$BACKUP_GPG_RECIPIENT" \
  --encrypt --output "$ENCRYPTED" "$DUMP"

# Verify the GPG-encrypted blob is non-empty and starts with the GPG magic byte
if ! head -c 1 "$ENCRYPTED" | od -An -tx1 | grep -q "85\|84\|c2"; then
  echo "[backup] FATAL — encrypted file does not look like a GPG message"; exit 1
fi

echo "[backup] upload to s3://$BACKUP_S3_BUCKET/deqah-$STAMP.dump.gpg"
AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
aws --endpoint-url "$BACKUP_S3_ENDPOINT" \
  s3 cp "$ENCRYPTED" "s3://$BACKUP_S3_BUCKET/deqah-$STAMP.dump.gpg" \
  --no-progress

# Best-effort: write a marker file so monitors can detect missed backups
AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
aws --endpoint-url "$BACKUP_S3_ENDPOINT" \
  s3 cp - "s3://$BACKUP_S3_BUCKET/last-success.txt" <<<"$STAMP"

# Local retention (offsite retention is bucket-lifecycle-rule territory).
find "$WORKDIR" -type f -name 'deqah-*.dump' -mtime "+$LOCAL_RETENTION_DAYS" -delete
find "$WORKDIR" -type f -name 'deqah-*.dump.gpg' -mtime "+$LOCAL_RETENTION_DAYS" -delete

# Drop the unencrypted dump immediately — only the .gpg should persist.
rm -f "$DUMP"

echo "[backup] ok — $STAMP uploaded"
