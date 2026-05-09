# P2.E — Offsite encrypted backups (2026-05-10)

> Audit 2026-05-09 finding: backups on the same VPS, no proven encryption,
> no restore testing. This runbook closes that gap.

## Threat model

- VPS compromise: attacker gains root on the Hetzner host.
  - Without offsite: all backups deleted/encrypted by ransomware → data loss.
  - With offsite + GPG: attacker has backup blobs but cannot decrypt without
    the offline GPG private key.
- Insider threat: ops with VPS access cannot reach offsite without separate
  R2/B2 credentials AND the GPG key.

## One-time setup

### 1. Generate the GPG keypair (offline machine)

```sh
gpg --batch --gen-key <<EOF
%no-protection
Key-Type: RSA
Key-Length: 4096
Name-Real: Deqah Backups
Name-Email: backups@deqah.app
Expire-Date: 0
EOF

# Export public key for the VPS
gpg --armor --export backups@deqah.app > deqah-backups.pub.asc

# Export private key — STORE OFFLINE in two places (e.g. encrypted USB + 1Password vault)
gpg --armor --export-secret-keys backups@deqah.app > deqah-backups.priv.asc
```

**The private key NEVER touches the VPS.**

### 2. Provision the public key on the VPS

```sh
scp deqah-backups.pub.asc deqah-vps:/tmp/
ssh deqah-vps 'gpg --import /tmp/deqah-backups.pub.asc && rm /tmp/deqah-backups.pub.asc'
```

### 3. Create the offsite bucket

Cloudflare R2 (recommended — free egress, S3-compatible):
1. Cloudflare dashboard → R2 → Create bucket `deqah-backups-prod`.
2. Create API token with R2 read/write on that bucket only.
3. Lifecycle rule: delete after 90 days.

### 4. Schedule the cron

On the Hetzner host:

```sh
sudo tee /etc/cron.d/deqah-backup <<'EOF'
# Daily 03:30 UTC backup
30 3 * * * root /opt/deqah/scripts/ops/backup-postgres-offsite.sh >> /var/log/deqah-backup.log 2>&1
EOF
```

Set the env vars in `/etc/default/deqah-backup` (chmod 600):

```sh
POSTGRES_HOST=deqah-database-jeprin
POSTGRES_USER=deqah
POSTGRES_DB=deqah
PGPASSWORD=<owner password>
BACKUP_S3_BUCKET=deqah-backups-prod
BACKUP_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
BACKUP_S3_ACCESS_KEY=<r2 access key>
BACKUP_S3_SECRET_KEY=<r2 secret>
BACKUP_GPG_RECIPIENT=backups@deqah.app
```

Modify the cron line to source it: `30 3 * * * root . /etc/default/deqah-backup && /opt/deqah/scripts/ops/backup-postgres-offsite.sh ...`

## Restore drill (mandatory monthly)

> Run on a throwaway VPS or local machine. NEVER on production.

```sh
# 1. Download a recent encrypted dump
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 ls s3://deqah-backups-prod/ | tail
aws --endpoint-url "$BACKUP_S3_ENDPOINT" s3 cp s3://deqah-backups-prod/deqah-<STAMP>.dump.gpg .

# 2. Decrypt with the private key (on the offline machine)
gpg --decrypt deqah-<STAMP>.dump.gpg > deqah-<STAMP>.dump

# 3. Restore into a throwaway database
docker run -d --name deqah-restore-test -e POSTGRES_PASSWORD=test -p 5499:5432 pgvector/pgvector:pg16
sleep 5
PGPASSWORD=test pg_restore --host=localhost --port=5499 --username=postgres --dbname=postgres \
  --create --no-owner --no-privileges deqah-<STAMP>.dump

# 4. Sanity-check
PGPASSWORD=test psql --host=localhost --port=5499 -U postgres -d deqah -c \
  'SELECT count(*) FROM "Organization"; SELECT max("createdAt") FROM "Booking";'

# 5. Tear down
docker rm -f deqah-restore-test
shred -u deqah-<STAMP>.dump deqah-<STAMP>.dump.gpg
```

Document the restore drill in `docs/operations/restore-drill-log.md` (date,
operator, dump used, RTO measured).

## Monitoring

Healthcheck endpoint: cron a separate task that pulls `last-success.txt` from
the bucket and alerts if the timestamp is older than 26 hours.

## What this does NOT replace

- **PITR (point-in-time recovery)**: pg_dump captures a logical snapshot. A
  proper PITR setup needs WAL archiving (pgbackrest or wal-g). This is a P3
  follow-up — daily logical dumps are the floor, not the ceiling.
- **Tenant-level export**: this is a whole-DB blob. Per-tenant data export
  for GDPR/data-subject-access requests is a separate flow.
