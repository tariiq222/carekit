# Module Ownership Matrix

**Status:** Living document — update whenever a module is added, split, or takes over a model.
**Last audited:** 2026-04-23

## Purpose

This is the single source of truth for **which module owns which Prisma models** and how modules depend on each other. The goal is boundary clarity without adding architectural ceremony (no repositories, no use-case layer, no DDD hierarchy).

## Rules

1. **One owner per Prisma model.** The owning cluster is the only one that writes to it. Other clusters read via the owner's handlers/services, never via `prisma.<otherModel>` directly.
2. **Cluster public API = `<cluster>.module.ts` exports.** The `exports: [...]` array in each `*.module.ts` file IS the public contract. No `index.ts` barrels — they would duplicate NestJS's own mechanism.
3. **Cross-cluster calls via DI only.** Consumer cluster registers the source cluster's module in `imports: []`, then injects the exported handler/service. Importing the class name for the DI type hint is the expected pattern.
4. **Cross-cluster side effects → events.** When the reaction isn't needed in-request (notifications, metering, audit log), use typed events under `<cluster>/events/` with reaction handlers like `payment-completed-handler/`, not chained service calls.
5. **Changes to this table require PR review** by a cluster owner on both sides.

## Ownership Table

| Module | Schema File | Owned Models |
|---|---|---|
| `identity` | `identity.prisma` | User, RefreshToken, ClientRefreshToken, OtpCode, UsedOtpSession, CustomRole, Permission |
| `people` | `people.prisma` | Client, Employee, EmployeeBranch, EmployeeService, EmployeeAvailability, EmployeeAvailabilityException, PasswordHistory |
| `bookings` | `bookings.prisma` | Booking, WaitlistEntry, GroupSession, GroupEnrollment, GroupSessionWaitlist, BookingStatusLog, BookingSettings |
| `finance` | `finance.prisma` | Invoice, Payment, Coupon, CouponRedemption, RefundRequest, ZatcaConfig, ZatcaSubmission |
| `comms` | `comms.prisma` | Notification, ChatConversation, CommsChatMessage, ContactMessage, EmailTemplate, OrganizationSmsConfig, SmsDelivery |
| `ai` | `ai.prisma` | KnowledgeDocument, DocumentChunk, ChatSession, ChatbotConfig, ChatMessage |
| `media` | `media.prisma` | File |
| `ops` | `ops.prisma` | ActivityLog, Report |
| `content` | `content.prisma` | SiteSetting |
| `org-config` | `organization.prisma` (shared) | Branch, Department, BusinessHour, Holiday, ServiceCategory |
| `org-experience` | `organization.prisma` (shared) | Service, ServiceBookingConfig, ServiceDurationOption, EmployeeServiceOption, BrandingConfig, IntakeForm, IntakeField, Rating, OrganizationSettings |
| `platform` | `platform.prisma` | Organization, Membership, Vertical, VerticalSeedDepartment, VerticalSeedServiceCategory, VerticalTerminologyOverride, Plan, Subscription, SubscriptionInvoice, UsageRecord, FeatureFlag, Integration, ProblemReport, ImpersonationSession, SuperAdminActionLog |

> Two clusters live under `apps/backend/src/modules/` but own no Prisma
> models: `integrations/` (Zoom credentials live as encrypted fields on the
> `platform.Integration` model; public-branding read endpoints) and
> `dashboard/` (read-only aggregate slice — `get-dashboard-stats`). They
> consume models owned by other clusters and are deliberately absent from the
> ownership table.

## Cross-Module Dependencies (as of 2026-04-23)

Direction: `A → B` means module A imports from module B.

| From | To | Legitimate? | Notes |
|---|---|---|---|
| `platform` | `identity` | ✅ | Billing/admin flows need User context |
| `identity` | `comms` | ✅ | OTP delivery via SMS/email |
| `finance` | `platform` | ✅ | Payments tie to Subscription/Organization |
| `bookings` | `org-experience` | ✅ | Bookings reference Service definitions |
| `org-experience` | `bookings` | ⚠️ review | Verify it's module wiring only, not data coupling |
| `org-experience` | `media` | ✅ | Branding/service images |
| `people` | `bookings` | ⚠️ review | Only DI wiring observed — keep it that way |
| `people` | `media` | ✅ | Employee/client avatars |
| `people` | `ops` | ⚠️ review | Imports `LogActivityHandler` directly — candidate for event instead |
| `ops` | `bookings` | ✅ | Activity/report generation over booking data |
| `ops` | `platform` | ✅ | Reports over Organization scope |

## Ambiguities & Tech Debt

1. **`organization.prisma` is split across two modules** (`org-config` + `org-experience`). This is intentional for now (structure vs. experience) but makes the schema file a shared surface. If it grows, consider splitting the schema file too.
2. **`ServiceCategory` owned by `org-config`, `Service` owned by `org-experience`** — parent/child models crossing module boundary. Keep an eye on it; if writes start happening from both sides, merge ownership.
3. **`OrganizationSettings` owned by `org-experience`** — name suggests `org-config`. Revisit if settings scope broadens.
4. **`people → ops` direct handler import** — should become a `ClientCreated` / `EmployeeUpdated` event consumed by ops.

## Enforcement

| Mechanism | Status | Notes |
|---|---|---|
| This ownership doc | ✅ | Reviewed on any model/cluster change |
| NestJS `exports: []` in `*.module.ts` | ✅ existing | The actual public API surface |
| `apps/backend/CLAUDE.md` cluster conventions | ✅ existing | Vertical slices, handler DI patterns |
| Code review on cross-cluster imports | ✅ manual | No automated rule — cannot statically verify "is target in `exports: []`" without a full type checker |
| ESLint `deqah/no-cross-cluster-import` | ❌ rejected 2026-04-23 | Conflicts with documented DI pattern: CLAUDE.md explicitly sanctions cross-cluster handler/service injection (`GetBookingSettingsHandler`, `PriceResolverService`). A blunt import-path rule would flag 23 legitimate DI type hints. |

## What to watch in code review

When reviewing cross-cluster imports, ask:

1. Is the imported class actually listed in the source cluster's `<cluster>.module.ts` `exports: []`?
2. Does the consuming cluster's module have the source module in its `imports: []`?
3. Is this a synchronous call that should be an event instead?
4. Is the caller reaching around DI (e.g. `new OtherClusterHelper()` or `prisma.<otherClustersModel>`)?

Violations of 1–4 are the things the code reviewer catches that a linter cannot.

## How to use this doc

- **Adding a model:** pick an owner from this table, add the model to its schema file, append the row here.
- **Need another module's data:** call the owner's service, don't reach for `prisma.<model>` in your module.
- **Spot a violation:** raise it in PR review — point reviewers to this doc.
