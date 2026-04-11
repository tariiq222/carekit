# White Label & Multi-Tenant Architecture Path

## Current Model: Single-Tenant per Deployment

CareKit is deployed as **one Docker container per client, one database per deployment**.

```
Client A → Docker (carekit_a) → PostgreSQL (carekit_a_db)
Client B → Docker (carekit_b) → PostgreSQL (carekit_b_db)
Client C → Docker (carekit_c) → PostgreSQL (carekit_c_db)
```

This is single-tenant by design. Each client's data is physically isolated.
`WhiteLabelConfig` handles per-client customization within each isolated deployment.

---

## Why EAV Already Works (and Is Sufficient Now)

The `WhiteLabelConfig` table uses an EAV (Entity-Attribute-Value) pattern:
- ~156 default config keys seeded at startup
- Admin-updatable from dashboard (logo, colors, fonts, payments keys, etc.)
- Cached via `WhiteLabelConfigService` (1800s TTL) — never scanned in full per-request
- New config keys can be added without schema migrations

This model is correct for the current single-tenant architecture.
No changes needed for the foreseeable roadmap.

---

## Multi-Tenant Path (If Ever Needed)

Multi-tenancy only makes sense if WebVue offers a **SaaS version** — shared infrastructure, multiple clinics on one database. This is NOT on the current roadmap.

If that decision is made, the migration path is:

### Option A: Row-Level Security (PostgreSQL RLS)
```sql
-- Add tenantId to every domain table
ALTER TABLE bookings ADD COLUMN tenant_id TEXT NOT NULL;

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: users only see their tenant's rows
CREATE POLICY tenant_isolation ON bookings
  USING (tenant_id = current_setting('app.tenant_id'));
```

Set `app.tenant_id` via Prisma middleware on every request:
```typescript
prisma.$use(async (params, next) => {
  await prisma.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  return next(params);
});
```

**Pros:** Zero overhead on queries, enforced at DB level
**Cons:** Requires `tenantId` FK on every model (large migration), complex for cross-tenant admin

### Option B: Schema-per-tenant
Each tenant gets their own PostgreSQL schema (`tenant_a.bookings`, `tenant_b.bookings`).
Prisma doesn't support schema-per-tenant natively — would require dynamic `search_path` injection.

**Pros:** Strong isolation, easy to dump/restore per tenant
**Cons:** Schema count grows linearly, Prisma limitations, index bloat

### Recommendation
If multi-tenant ever becomes a requirement:
1. Add `tenantId` to a `Tenant` model
2. Add `tenantId FK` to `User`, `Practitioner`, `Booking`, `Payment` first (the core 4)
3. Implement RLS with Prisma middleware
4. Migrate `WhiteLabelConfig` → `TenantConfig` (keyed by tenantId, not global EAV)

---

## Current Branch Support (Phase 6)

Multi-branch within a single tenant/deployment is already being addressed:
- `Branch` model exists with `PractitionerBranch` assignments
- `BookingSettings.branchId` (Phase 6): per-branch policy overrides
- `PractitionerAvailability.branchId` (Phase 6): branch-scoped availability
- `IntakeForm.branchId`: already exists
- Next step when branches become active: add `branchId` to `Booking` model to scope booking history per branch

Multi-branch ≠ multi-tenant. Branch is a sub-unit within the same client deployment.
