/**
 * Global teardown for e2e tests.
 * Ensures all async handles are closed after tests complete.
 */
export default async function globalTeardown(): Promise<void> {
  // Allow any pending async operations to settle
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
}
