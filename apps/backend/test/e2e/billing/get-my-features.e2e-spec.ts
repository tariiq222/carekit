import SuperTest from "supertest";
import * as jwt from "jsonwebtoken";
import { createTestApp, closeTestApp } from "../../setup/app.setup";
import { testPrisma } from "../../setup/db.setup";

/**
 * T-10 — Integration tests for GET /dashboard/billing/my-features
 *
 * Full HTTP-stack tests via Supertest: NestJS app → JwtGuard →
 * TenantResolverMiddleware → BillingController → GetMyFeaturesHandler →
 * SubscriptionCacheService → Prisma → real test DB.
 *
 * Auth notes
 * ----------
 * TenantResolverMiddleware reads `organizationId` from the JWT claim
 * (strict mode).  The `createTestToken` helper does NOT embed it, so every
 * test in this file mints its own JWT via `mintToken(userId, orgId)`.
 *
 * Isolation
 * ---------
 * Each test creates a unique org slug (`tc<N>-<role>-<ts>`) so subscription /
 * subscription state never bleeds between cases, and SubscriptionCacheService
 * in-process entries stay completely independent.
 */

// ─── Constants ─────────────────────────────────────────────────────────────

/** Must match the JWT_ACCESS_SECRET set by createTestApp(). */
const ACCESS_SECRET = "test-access-secret-32chars-min";

/**
 * The `admin@e2e.test` user created by `ensureTestUsers()` (called inside
 * `createTestApp()`).  We borrow its stable ID so the JwtStrategy can look
 * it up without extra seeding.
 */
const ADMIN_USER_ID = "user-admin-e2e";

// ─── JWT factory ───────────────────────────────────────────────────────────

/**
 * Mints a signed access-token that carries `organizationId` in the payload.
 *
 * This is the minimal set of claims that:
 *  1. JwtGuard accepts (valid signature + non-expired).
 *  2. JwtStrategy.validate() maps to `req.user`.
 *  3. TenantResolverMiddleware resolves to a concrete org (strict mode).
 */
function mintToken(userId: string, organizationId: string): string {
  return jwt.sign(
    {
      sub: userId,
      email: "admin@e2e.test",
      role: "ADMIN",
      organizationId,
      customRoleId: null,
      permissions: [],
      features: [],
    },
    ACCESS_SECRET,
    { expiresIn: "1h" },
  );
}

// ─── Seed helpers ──────────────────────────────────────────────────────────

/**
 * Creates (or finds) an org then upserts a subscription for the given plan.
 * Returns the org's UUID and the plan's parsed limits so callers can build
 * assertions without hard-coding magic numbers.
 */
async function seedOrgWithSubscription(opts: {
  slug: string;
  nameAr: string;
  planSlug: "BASIC" | "PRO" | "ENTERPRISE";
  status?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
}): Promise<{ orgId: string; planLimits: Record<string, unknown> }> {
  const { slug, nameAr, planSlug, status = "ACTIVE" } = opts;

  const org = await testPrisma.organization.upsert({
    where: { slug },
    update: {},
    create: { slug, nameAr, status: "ACTIVE" },
    select: { id: true },
  });

  const plan = await testPrisma.plan.findFirstOrThrow({
    where: { slug: planSlug },
    select: { id: true, limits: true },
  });

  await testPrisma.subscription.upsert({
    where: { organizationId: org.id },
    update: { planId: plan.id, status },
    create: {
      organizationId: org.id,
      planId: plan.id,
      status,
      billingCycle: "MONTHLY",
      currentPeriodStart: new Date("2031-06-01T00:00:00Z"),
      currentPeriodEnd: new Date("2031-07-01T00:00:00Z"),
    },
  });

  return {
    orgId: org.id,
    planLimits: plan.limits as Record<string, unknown>,
  };
}

// ─── Suite ─────────────────────────────────────────────────────────────────

describe("GET /dashboard/billing/my-features (e2e)", () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createTestApp());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-1 — Happy path: PRO plan, ACTIVE status
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Verifies the full response shape matches the T-05 contract:
   *   { planSlug, status, features: { [key]: { enabled, [limit?, currentCount?] } } }
   *
   * PRO plan seeds `recurring_bookings: true` in the limits JSON, so that
   * feature must appear with enabled === true.
   */
  it("[TC-1] PRO plan + ACTIVE → 200, correct planSlug / status, recurring_bookings enabled", async () => {
    const ts = Date.now();
    const { orgId } = await seedOrgWithSubscription({
      slug: `tc1-pro-${ts}`,
      nameAr: "منظمة برو",
      planSlug: "PRO",
      status: "ACTIVE",
    });

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, orgId)}`);

    expect(res.status).toBe(200);

    // Top-level envelope
    expect(res.body.planSlug).toBe("PRO");
    expect(res.body.status).toBe("ACTIVE");
    expect(res.body.features).toBeDefined();
    expect(typeof res.body.features).toBe("object");

    // PRO enables recurring bookings
    expect(res.body.features).toHaveProperty("recurring_bookings");
    expect(res.body.features.recurring_bookings.enabled).toBe(true);

    // Structural invariant: every entry must have an `enabled` boolean
    for (const entry of Object.values<Record<string, unknown>>(
      res.body.features,
    )) {
      expect(typeof entry.enabled).toBe("boolean");
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-2 — BASIC plan disables RECURRING_BOOKINGS
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * The BASIC plan limits JSON sets `recurring_bookings: false`.
   * No override exists for this org; the handler derives `enabled` directly
   * from the plan limit value → enabled must be false.
   */
  it("[TC-2] BASIC plan → recurring_bookings.enabled === false", async () => {
    const ts = Date.now();
    const { orgId } = await seedOrgWithSubscription({
      slug: `tc2-basic-${ts}`,
      nameAr: "منظمة أساسية",
      planSlug: "BASIC",
      status: "ACTIVE",
    });

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, orgId)}`);

    expect(res.status).toBe(200);
    expect(res.body.planSlug).toBe("BASIC");

    const recurringBookings = res.body.features.recurring_bookings;
    expect(recurringBookings).toBeDefined();
    expect(recurringBookings.enabled).toBe(false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-3 — ENTERPRISE enables all enterprise-only features
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * ENTERPRISE plan seeds all four gated features as `true` in limits JSON:
   *   advanced_reports, custom_roles, activity_log.
   *
   * The handler derives `enabled` directly from the plan limits JSON.
   */
  it("[TC-3] ENTERPRISE plan → advanced_reports, custom_roles, activity_log all enabled", async () => {
    const ts = Date.now();
    const { orgId } = await seedOrgWithSubscription({
      slug: `tc3-ent-${ts}`,
      nameAr: "منظمة مؤسسية",
      planSlug: "ENTERPRISE",
      status: "ACTIVE",
    });

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, orgId)}`);

    expect(res.status).toBe(200);
    expect(res.body.planSlug).toBe("ENTERPRISE");

    expect(res.body.features.advanced_reports?.enabled).toBe(true);
    expect(res.body.features.custom_roles?.enabled).toBe(true);
    expect(res.body.features.activity_log?.enabled).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-4 — Unauthorized: missing JWT → 401
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * JwtGuard is applied at the controller level.  Any request without a valid
   * Authorization header must be rejected before the handler is invoked.
   */
  it("[TC-4] no Authorization header → 401", async () => {
    const res = await req.get("/dashboard/billing/my-features");

    expect(res.status).toBe(401);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-5 — Quantitative features carry currentCount
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * Seeds exactly 5 employees + 2 active branches under a PRO org, then
   * asserts the response carries matching currentCount values.
   *
   * PRO plan limits include numeric quotas for `maxEmployees` and `maxBranches`,
   * so the handler must return { enabled, limit, currentCount } for both.
   *
   * Seeding is done directly via testPrisma to target the per-test orgId —
   * the seedEmployee / seedBranch helpers hard-code DEFAULT_ORG_ID and cannot
   * be used here without corrupting counts across tests.
   */
  it("[TC-5] PRO plan with 5 employees + 2 branches → currentCount values match", async () => {
    const ts = Date.now();
    const { orgId } = await seedOrgWithSubscription({
      slug: `tc5-qty-${ts}`,
      nameAr: "منظمة عدّاد",
      planSlug: "PRO",
      status: "ACTIVE",
    });

    // Seed 5 employees scoped to this org
    for (let i = 1; i <= 5; i++) {
      await testPrisma.employee.create({
        data: {
          organizationId: orgId,
          name: `موظف ${i}`,
          isActive: true,
          employmentType: "FULL_TIME",
        },
      });
    }

    // Seed 2 active branches scoped to this org
    for (let i = 1; i <= 2; i++) {
      await testPrisma.branch.create({
        data: {
          organizationId: orgId,
          nameAr: `فرع ${i}`,
          isActive: true,
        },
      });
    }

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, orgId)}`);

    expect(res.status).toBe(200);

    // employees — quantitative: currentCount must equal exactly 5
    // Key in response is the plan-limits JSON key: "maxEmployees" (via FEATURE_KEY_MAP).
    const employees = res.body.features.maxEmployees;
    expect(employees).toBeDefined();
    expect(employees.currentCount).toBe(5);
    expect(typeof employees.limit).toBe("number");
    expect(employees).toHaveProperty("enabled");

    // branches — quantitative: currentCount must equal exactly 2
    // Key in response is the plan-limits JSON key: "maxBranches" (via FEATURE_KEY_MAP).
    const branches = res.body.features.maxBranches;
    expect(branches).toBeDefined();
    expect(branches.currentCount).toBe(2);
    expect(typeof branches.limit).toBe("number");
    expect(branches).toHaveProperty("enabled");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-6 — TRIALING status is reflected in the response
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * When the subscription is in TRIALING state the handler must return
   *   { status: "TRIALING", planSlug: "BASIC", features: { … } }
   * rather than the no-subscription fallback (empty features map).
   *
   * This guards against the SubscriptionCacheService short-circuit that
   * returns null (and causes an empty features fallback) when no subscription
   * row exists vs when a TRIALING row does exist.
   */
  it("[TC-6] TRIALING subscription → status TRIALING, features map populated", async () => {
    const ts = Date.now();
    const { orgId } = await seedOrgWithSubscription({
      slug: `tc6-trial-${ts}`,
      nameAr: "منظمة تجريبية",
      planSlug: "BASIC",
      status: "TRIALING",
    });

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, orgId)}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("TRIALING");
    expect(res.body.planSlug).toBe("BASIC");
    // features must be the full BASIC map, not an empty object
    expect(Object.keys(res.body.features).length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-7 — No subscription → graceful safe-default response
  // ──────────────────────────────────────────────────────────────────────────
  /**
   * When an org has no subscription row at all, SubscriptionCacheService.get()
   * returns null and the handler returns the safe default:
   *   { planSlug: "BASIC", status: "TRIALING", features: {} }
   *
   * This prevents the endpoint from crashing for newly-created orgs during
   * the onboarding window before a plan is chosen.
   */
  it("[TC-7] org with no subscription → 200 with safe fallback {planSlug: BASIC, status: TRIALING, features: {}}", async () => {
    const ts = Date.now();
    const slug = `tc7-nosub-${ts}`;

    const org = await testPrisma.organization.upsert({
      where: { slug },
      update: {},
      create: { slug, nameAr: "منظمة بلا اشتراك", status: "ACTIVE" },
      select: { id: true },
    });

    const res = await req
      .get("/dashboard/billing/my-features")
      .set("Authorization", `Bearer ${mintToken(ADMIN_USER_ID, org.id)}`);

    expect(res.status).toBe(200);
    expect(res.body.planSlug).toBe("BASIC");
    expect(res.body.status).toBe("TRIALING");
    expect(res.body.features).toEqual({});
  });
});
