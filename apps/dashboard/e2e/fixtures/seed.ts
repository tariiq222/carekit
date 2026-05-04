/**
 * e2e/fixtures/seed.ts
 *
 * Deterministic test data helpers for Playwright e2e tests.
 *
 * These helpers create predictable, isolated test data before a test run
 * and clean it up after.  Full implementation is out of scope for the
 * initial restructure — stubs with TODO comments are provided.
 *
 * Usage pattern (intended, not yet implemented):
 *   import { seedClient, cleanupClient } from '../fixtures/seed';
 *
 *   test.beforeEach(async () => { clientId = await seedClient(); });
 *   test.afterEach(async () => { await cleanupClient(clientId); });
 */

export interface SeededClient {
  id: string;
  nameAr: string;
  nameEn: string;
  phone: string;
}

export interface SeededEmployee {
  id: string;
  nameAr: string;
  nameEn: string;
  email: string;
}

export interface SeededBooking {
  id: string;
  clientId: string;
  employeeId: string;
  startsAt: string;
}

/**
 * TODO (seed.ts): implement via direct backend API calls using a seeding
 * access token stored in SEED_API_TOKEN env var, or via a dedicated
 * /e2e/seed endpoint gated behind NODE_ENV !== 'production'.
 */
export async function seedClient(_overrides?: Partial<SeededClient>): Promise<SeededClient> {
  throw new Error('TODO: seedClient not yet implemented — see e2e/fixtures/seed.ts');
}

export async function cleanupClient(_id: string): Promise<void> {
  throw new Error('TODO: cleanupClient not yet implemented — see e2e/fixtures/seed.ts');
}

export async function seedEmployee(_overrides?: Partial<SeededEmployee>): Promise<SeededEmployee> {
  throw new Error('TODO: seedEmployee not yet implemented — see e2e/fixtures/seed.ts');
}

export async function cleanupEmployee(_id: string): Promise<void> {
  throw new Error('TODO: cleanupEmployee not yet implemented — see e2e/fixtures/seed.ts');
}

export async function seedBooking(_overrides?: Partial<SeededBooking>): Promise<SeededBooking> {
  throw new Error('TODO: seedBooking not yet implemented — see e2e/fixtures/seed.ts');
}

export async function cleanupBooking(_id: string): Promise<void> {
  throw new Error('TODO: cleanupBooking not yet implemented — see e2e/fixtures/seed.ts');
}
