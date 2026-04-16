# Departments — Security / Tenant Isolation / RBAC Audit (Session 2: API)

**Date:** 2026-04-16
**Tester:** Claude (curl + Prisma inspection)
**Environment:** backend :5100 · DB `carekit_v2`
**Scope:** API-level security — tenant isolation, header spoofing, RBAC, JWT tampering, refresh rotation.

---

## Summary

| Area | Result |
|---|---|
| Cross-tenant PATCH/DELETE via URL | ✅ returns 404, no leak |
| Cross-tenant via `X-Tenant-ID` header spoof | ✅ rejected with 403 "Tenant mismatch" |
| List endpoint scoping | ✅ each token only sees its own tenant's departments |
| RECEPTIONIST role on all department endpoints | ✅ 403 "Insufficient permissions" (read + write + delete) |
| JWT tampered signature | ✅ 401 |
| JWT `alg:none` attack | ✅ 401 |
| JWT expired `exp` | ✅ 401 |
| Refresh-token rotation (replay) | ✅ second use of same refresh → 401 |

**No security bugs found.** One product-level design question about RECEPTIONIST read access.

---

## Test setup

- Seeded a second tenant (`c7b7c7b7-…`) + ADMIN user + 1 department via Prisma.
- Logged in as tenant-1 admin (`admin@carekit-test.com`), tenant-2 admin (`admin@tenant2.test`), and an existing RECEPTIONIST under tenant-1 (password reset via script).
- All scripts removed after the session. Tenant-2 data deleted.

---

## Detailed results

### T1 → T2 via URL only

```
PATCH /dashboard/organization/departments/<tenant-2 dept id>
  Auth: tenant-1 admin JWT     X-Tenant-ID: tenant-1
  → 404 Not Found  ✅
  (updateMany(where: {id, tenantId}) returns count:0 → NotFoundException)
```

```
DELETE /dashboard/organization/departments/<tenant-2 dept id>
  Auth: tenant-1 admin JWT     X-Tenant-ID: tenant-1
  → 404 Not Found  ✅
  (deleteMany(where: {id, tenantId}) same pattern)
```

Verified the tenant-2 department remained intact by re-reading with tenant-2 credentials.

### JWT tenantId ≠ `X-Tenant-ID` header

```
GET  …/departments              → 403 "Tenant mismatch"
PATCH …/departments/:id         → 403 "Tenant mismatch"
DELETE …/departments/:id        → 403 "Tenant mismatch"
```

The interceptor (`TenantGuard` or equivalent) compares the two before any business logic runs. Good.

### List scoping

```
T1 admin  →  GET list  →  6 items,  all tenantId = T1  ✅
T2 admin  →  GET list  →  1 item,   tenantId = T2      ✅
```

No leak across tenants.

### RBAC — RECEPTIONIST role

```
GET    list    → 403 "Insufficient permissions"
POST   create  → 403 "Insufficient permissions"
DELETE :id     → 403 "Insufficient permissions"
```

CASL `@CheckPermissions(['read'|'create'|'update'|'delete', 'Department'])` on every controller method matches the RECEPTIONIST permission set (which excludes Department:read).

### JWT tampering

| Attack | Response |
|---|---|
| Flipped last byte of signature | 401 |
| Crafted `{alg: "none"}` header + role="OWNER" payload | 401 |
| Expired `exp` (1970-epoch), fake signature | 401 |

All rejected at the JwtGuard layer — `alg:none` specifically **is not** honored (common pitfall in libraries that auto-pick algorithm from the header).

### Refresh-token rotation

```
POST /auth/refresh { refreshToken: RT1 } → 200 { accessToken: AT2, refreshToken: RT2 }
POST /auth/refresh { refreshToken: RT1 } → 401 "Invalid or expired refresh token"
```

Replay is blocked. Rotated tokens are single-use.

---

## 🟡 Product design question (not a bug)

### #S1 — RECEPTIONIST cannot read department list

Today, a RECEPTIONIST gets **403 on GET /departments**. If the booking or client-intake UI on mobile/dashboard shows a department picker (even read-only), a receptionist won't be able to load it.

- If they don't need it: leave as-is.
- If they do: grant `read:Department` to the RECEPTIONIST role in the CASL ability factory (keep write/delete locked).

This needs a product call, not a code fix in this audit.

---

## Verdict

Tenant isolation and RBAC for the departments module are **sound**. The combination of:

1. `X-Tenant-ID` vs JWT `tenantId` verification before handlers,
2. `updateMany`/`deleteMany` with `where: { id, tenantId }` instead of `findFirst` + mutation,
3. `@CheckPermissions(…, 'Department')` on every endpoint,
4. JWT algorithm pinning + refresh-token rotation,

covers the attack surface for this module. No code changes recommended from this session.
