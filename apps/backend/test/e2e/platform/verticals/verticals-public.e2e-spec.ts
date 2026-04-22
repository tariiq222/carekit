import SuperTest from 'supertest';
import { createVerticalsTestApp, closeVerticalsTestApp } from './verticals-test-app';
import { TERMINOLOGY_KEYS } from '@carekit/shared/terminology';

// Seeded slugs from migration 20260422080855 — stable UUIDs in test DB
const DENTAL_SLUG = 'dental';
const BARBERSHOP_SLUG = 'barbershop';
const UNKNOWN_SLUG = 'does-not-exist-zzzz';

describe('GET /public/verticals (e2e)', () => {
  let req: SuperTest.Agent;

  beforeAll(async () => {
    ({ request: req } = await createVerticalsTestApp());
  });

  afterAll(async () => {
    await closeVerticalsTestApp();
  });

  it('returns 200 with an array of active verticals ordered by sortOrder', async () => {
    const res = await req.get('/public/verticals').expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);

    const items = res.body as Array<Record<string, unknown>>;
    // All returned items must be active
    for (const item of items) {
      expect(item.isActive).toBe(true);
    }
    // Must be sorted ascending by sortOrder
    for (let i = 1; i < items.length; i++) {
      expect(Number(items[i].sortOrder)).toBeGreaterThanOrEqual(Number(items[i - 1].sortOrder));
    }
  });

  it('GET /public/verticals/:slug returns 200 with seedDepartments and seedServiceCategories', async () => {
    const res = await req.get(`/public/verticals/${DENTAL_SLUG}`).expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body.slug).toBe(DENTAL_SLUG);
    expect(Array.isArray(body.seedDepartments)).toBe(true);
    expect(Array.isArray(body.seedServiceCategories)).toBe(true);
    // Dental has 4 departments seeded
    expect((body.seedDepartments as unknown[]).length).toBe(4);
    // Dental has 4 service categories seeded
    expect((body.seedServiceCategories as unknown[]).length).toBe(4);
  });

  it('GET /public/verticals/:slug returns 404 for unknown slug', async () => {
    await req.get(`/public/verticals/${UNKNOWN_SLUG}`).expect(404);
  });

  it('GET /public/verticals/:slug/terminology returns 200 with all 19 terminology keys', async () => {
    const res = await req.get(`/public/verticals/${DENTAL_SLUG}/terminology`).expect(200);

    const body = res.body as Record<string, Record<string, string>>;
    // Use Object.keys check — toHaveProperty treats dots as path separators
    const responseKeys = Object.keys(body);
    for (const key of TERMINOLOGY_KEYS) {
      expect(responseKeys).toContain(key);
      expect(typeof body[key].ar).toBe('string');
      expect(typeof body[key].en).toBe('string');
    }
    // Total count: 19 keys
    expect(responseKeys.length).toBe(TERMINOLOGY_KEYS.length);
  });

  it('terminology family routing — MEDICAL vertical uses medical pack, SALON vertical uses salon pack', async () => {
    // dental → MEDICAL family → client.singular = مريض (patient)
    const medicalRes = await req.get(`/public/verticals/${DENTAL_SLUG}/terminology`).expect(200);
    const medicalBody = medicalRes.body as Record<string, Record<string, string>>;
    expect(medicalBody['client.singular'].ar).toBe('مريض');

    // barbershop → SALON family → client.singular ≠ مريض
    const salonRes = await req.get(`/public/verticals/${BARBERSHOP_SLUG}/terminology`).expect(200);
    const salonBody = salonRes.body as Record<string, Record<string, string>>;
    expect(salonBody['client.singular'].ar).not.toBe('مريض');
    // Salon uses 'عميل' (client/customer)
    expect(salonBody['client.singular'].ar).toBe('عميل');
  });
});
