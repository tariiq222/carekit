# Migration Rollback Runbook

## When to Use

- A Prisma migration fails or causes issues in **production**
- A deployed migration introduces data corruption or breaks application functionality
- You need to undo a schema change that has already been applied

## Prerequisites

- SSH access to the production server
- PostgreSQL credentials (from `.env` or Docker secrets)
- Access to the backup service (MinIO / host volume)
- A staging environment to test rollback before applying to production

---

## Option A: Compensating Migration (Recommended)

Prisma does not support `down` migrations. The safest approach is a **new forward migration** that reverses the change.

1. **Identify the change** — review the failed migration SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`
2. **Write the reverse schema change** in `schema.prisma` (e.g., remove the added column, restore the dropped column)
3. **Generate the migration:**
   ```bash
   npx prisma migrate dev --name rollback_<original_name>
   ```
4. **Review the generated SQL** in the new migration file
5. **Test in staging** — deploy to staging and verify the rollback works correctly
6. **Deploy to production:**
   ```bash
   npx prisma migrate deploy
   ```
7. **Log the rollback** in your team's incident channel and tag it with the original migration name (the historical `docs/operations/migration-log.md` is no longer maintained)

---

## Option B: Restore from Backup

Use this when the migration caused data loss or corruption that cannot be fixed with a compensating migration.

1. **Stop the application** to prevent further writes:
   ```bash
   docker compose stop app
   ```
2. **Identify the correct backup** (pre-migration snapshot):
   ```bash
   ls -la /backups/postgres/
   # Backups are AES-256-CBC encrypted (.dump.enc)
   # You need BACKUP_ENCRYPTION_KEY from your secrets vault to restore
   ```
3. **Run the restore script:**
   ```bash
   bash docker/scripts/restore.sh <backup-file.dump.enc>
   # The restore script decrypts using BACKUP_ENCRYPTION_KEY before passing to pg_restore
   ```
4. **Mark the failed migration as rolled back** in the `_prisma_migrations` table:
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '<failed_migration_name>';
   ```
5. **Revert `schema.prisma`** to match the restored database state (git checkout the previous version)
6. **Restart the application:**
   ```bash
   docker compose up -d app
   ```
7. **Verify** the application is working correctly

---

## Option C: Manual SQL

For simple, reversible changes (e.g., added a column, renamed a column), manual SQL may be fastest.

1. **Connect to the database:**
   ```bash
   docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
   ```
2. **Run the reverse SQL** — examples:
   - Added a column: `ALTER TABLE "TableName" DROP COLUMN "column_name";`
   - Added an index: `DROP INDEX "index_name";`
   - Changed column type: `ALTER TABLE "TableName" ALTER COLUMN "col" TYPE old_type;`
3. **Update the `_prisma_migrations` table:**
   ```sql
   DELETE FROM _prisma_migrations WHERE migration_name = '<migration_name>';
   ```
4. **Revert `schema.prisma`** to match the current database state
5. **Run `prisma migrate dev`** to confirm schema and migration history are in sync

---

## Important Warnings

- **Prisma has no native `down` migration support** — you must always roll forward or restore from backup
- **Never edit a committed migration file** — create a new compensating migration instead
- **Always test in staging first** — never run untested rollbacks directly on production
- **Back up before rollback** — take a fresh backup before attempting any rollback, in case the rollback itself fails
- **Data migrations are irreversible** — if the migration deleted or transformed data, only Option B (backup restore) can recover it
- **Coordinate with the team** — notify all developers before and after a rollback to avoid schema conflicts

---

## Emergency Contacts / Escalation

| Role               | Contact              | When to Escalate                        |
|--------------------|----------------------|-----------------------------------------|
| Backend Lead       | [TBD — add contact]  | Any failed production migration         |
| DevOps / Infra     | [TBD — add contact]  | Backup restore needed, server access    |
| Project Manager    | [TBD — add contact]  | Data loss or extended downtime           |
