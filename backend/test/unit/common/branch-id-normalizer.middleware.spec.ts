/**
 * BranchIdNormalizerMiddleware Unit Tests
 *
 * Regression: when multi_branch feature flag is disabled, branchId must be
 * stripped from every request so all downstream services fall back to
 * global/branch-agnostic queries.
 */
import { BranchIdNormalizerMiddleware } from '../../../src/common/middleware/branch-id-normalizer.middleware.js';
import type { FeatureFlagsService } from '../../../src/modules/feature-flags/feature-flags.service.js';

const mockFeatureFlagsService = {
  isEnabled: jest.fn(),
} as unknown as FeatureFlagsService;

function buildMiddleware() {
  return new BranchIdNormalizerMiddleware(mockFeatureFlagsService);
}

function mockNext() {
  return jest.fn();
}

describe('BranchIdNormalizerMiddleware', () => {
  afterEach(() => jest.resetAllMocks());

  describe('multi_branch DISABLED', () => {
    beforeEach(() => {
      (mockFeatureFlagsService.isEnabled as jest.Mock).mockResolvedValue(false);
    });

    it('strips branchId from query string', async () => {
      const req = { query: { branchId: 'some-uuid', status: 'active' }, body: {} } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect((req as { query: Record<string, unknown> }).query).not.toHaveProperty('branchId');
      expect((req as { query: Record<string, unknown> }).query).toHaveProperty('status', 'active');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('strips branchId from request body', async () => {
      const req = {
        query: {},
        body: { branchId: 'some-uuid', date: '2026-04-10', practitionerId: 'p1' },
      } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect((req as { body: Record<string, unknown> }).body).not.toHaveProperty('branchId');
      expect((req as { body: Record<string, unknown> }).body).toHaveProperty('date', '2026-04-10');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('handles request with no branchId gracefully', async () => {
      const req = { query: { status: 'confirmed' }, body: { serviceId: 'svc1' } } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect((req as { query: Record<string, unknown> }).query).toEqual({ status: 'confirmed' });
      expect((req as { body: Record<string, unknown> }).body).toEqual({ serviceId: 'svc1' });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('always calls next() even when flag is disabled', async () => {
      const req = { query: {}, body: {} } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi_branch ENABLED', () => {
    beforeEach(() => {
      (mockFeatureFlagsService.isEnabled as jest.Mock).mockResolvedValue(true);
    });

    it('preserves branchId in query string', async () => {
      const req = { query: { branchId: 'branch-uuid' }, body: {} } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect((req as { query: Record<string, unknown> }).query).toHaveProperty(
        'branchId',
        'branch-uuid',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('preserves branchId in request body', async () => {
      const req = { query: {}, body: { branchId: 'branch-uuid', date: '2026-04-10' } } as never;
      const next = mockNext();

      await buildMiddleware().use(req, {} as never, next);

      expect((req as { body: Record<string, unknown> }).body).toHaveProperty(
        'branchId',
        'branch-uuid',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  it('calls featureFlagsService.isEnabled with "multi_branch"', async () => {
    (mockFeatureFlagsService.isEnabled as jest.Mock).mockResolvedValue(true);
    const req = { query: {}, body: {} } as never;

    await buildMiddleware().use(req, {} as never, mockNext());

    expect(mockFeatureFlagsService.isEnabled).toHaveBeenCalledWith('multi_branch');
  });
});
