-- Defensive rename: any Permission rows with subject='whitelabel' become subject='branding'.
-- No-op on environments where no such rows exist (seed does not produce them).
UPDATE "Permission"
SET "subject" = 'branding'
WHERE "subject" = 'whitelabel';
