-- Migration: add_db_audit_indexes_2026_05
-- DB-05: Composite @@unique([id, organizationId]) on 11 parent tables
-- DB-06: Evidence-backed composite indexes (EXPLAIN ANALYZE in docs/architecture/index-audit-2026-05.md)
-- DB-07: Drop redundant Booking(employeeId) index

-- ─── DB-05: Composite uniques ────────────────────────────────────────────────

-- Booking
CREATE UNIQUE INDEX CONCURRENTLY "booking_id_org" ON "Booking"("id", "organizationId");

-- GroupSession
CREATE UNIQUE INDEX CONCURRENTLY "group_session_id_org" ON "GroupSession"("id", "organizationId");

-- Invoice
CREATE UNIQUE INDEX CONCURRENTLY "invoice_id_org" ON "Invoice"("id", "organizationId");

-- Branch
CREATE UNIQUE INDEX CONCURRENTLY "branch_id_org" ON "Branch"("id", "organizationId");

-- Department
CREATE UNIQUE INDEX CONCURRENTLY "department_id_org" ON "Department"("id", "organizationId");

-- ServiceCategory
CREATE UNIQUE INDEX CONCURRENTLY "service_category_id_org" ON "ServiceCategory"("id", "organizationId");

-- Service
CREATE UNIQUE INDEX CONCURRENTLY "service_id_org" ON "Service"("id", "organizationId");

-- IntakeForm
CREATE UNIQUE INDEX CONCURRENTLY "intake_form_id_org" ON "IntakeForm"("id", "organizationId");

-- Employee
CREATE UNIQUE INDEX CONCURRENTLY "employee_id_org" ON "Employee"("id", "organizationId");

-- Client
CREATE UNIQUE INDEX CONCURRENTLY "client_id_org" ON "Client"("id", "organizationId");

-- CustomRole
CREATE UNIQUE INDEX CONCURRENTLY "custom_role_id_org" ON "CustomRole"("id", "organizationId");

-- ─── DB-06: Hot-path composite indexes ───────────────────────────────────────

-- Notification(recipientId, isRead, createdAt) — replaces (recipientId, createdAt)
-- Evidence: bitmap heap scan removing 34% of rows as isRead filter
DROP INDEX CONCURRENTLY IF EXISTS "Notification_recipientId_createdAt_idx";
CREATE INDEX CONCURRENTLY "Notification_recipientId_isRead_createdAt_idx" ON "Notification"("recipientId", "isRead", "createdAt");

-- Invoice(organizationId, status, dueAt) — AR aging query was 30ms
CREATE INDEX CONCURRENTLY "Invoice_organizationId_status_dueAt_idx" ON "Invoice"("organizationId", "status", "dueAt");

-- ActivityLog(organizationId, occurredAt) — replaces (organizationId) + (occurredAt)
DROP INDEX CONCURRENTLY IF EXISTS "ActivityLog_organizationId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "ActivityLog_occurredAt_idx";
CREATE INDEX CONCURRENTLY "ActivityLog_organizationId_occurredAt_idx" ON "ActivityLog"("organizationId", "occurredAt");

-- SmsDelivery(status, createdAt) — replaces (status) + (createdAt)
DROP INDEX CONCURRENTLY IF EXISTS "SmsDelivery_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "SmsDelivery_createdAt_idx";
CREATE INDEX CONCURRENTLY "SmsDelivery_status_createdAt_idx" ON "SmsDelivery"("status", "createdAt");

-- NotificationDeliveryLog(status, createdAt) — replaces standalone (createdAt)
DROP INDEX CONCURRENTLY IF EXISTS "NotificationDeliveryLog_createdAt_idx";
CREATE INDEX CONCURRENTLY "NotificationDeliveryLog_status_createdAt_idx" ON "NotificationDeliveryLog"("status", "createdAt");

-- ─── DB-07: Drop redundant Booking(employeeId) index ─────────────────────────
-- Rationale: [employeeId, scheduledAt] and [employeeId, endsAt] cover all
-- single-column employeeId queries as leading-prefix scans.
DROP INDEX CONCURRENTLY IF EXISTS "Booking_employeeId_idx";
