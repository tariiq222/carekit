/**
 * FeatureFlagGuard Unit Tests
 * Covers: public routes bypass, no decorator bypass, feature enabled pass,
 *         feature disabled block (ForbiddenException), license-disabled block
 */
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagGuard } from '../../../../src/common/guards/feature-flag.guard.js';
import { FeatureFlagsService } from '../../../../src/modules/feature-flags/feature-flags.service.js';

function createMockContext(handler = jest.fn(), classRef = jest.fn()) {
  return {
    getHandler: () => handler,
    getClass: () => classRef,
  } as any;
}

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: jest.Mocked<Reflector>;
  let featureFlagsService: jest.Mocked<Pick<FeatureFlagsService, 'isEnabled'>>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    featureFlagsService = {
      isEnabled: jest.fn(),
    };

    guard = new FeatureFlagGuard(
      reflector as any,
      featureFlagsService as any,
    );
  });

  it('allows access when route is marked @Public', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true)   // IS_PUBLIC_KEY → true
      .mockReturnValueOnce(undefined);

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
  });

  it('allows access when no @RequireFeature decorator is set', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)     // IS_PUBLIC_KEY → false
      .mockReturnValueOnce(undefined); // REQUIRE_FEATURE_KEY → undefined

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
  });

  it('allows access when feature is enabled AND licensed', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)      // not public
      .mockReturnValueOnce('coupons'); // feature key
    featureFlagsService.isEnabled.mockResolvedValue(true);

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith('coupons');
  });

  it('throws ForbiddenException when feature flag is disabled', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('chatbot');
    featureFlagsService.isEnabled.mockResolvedValue(false);

    const promise = guard.canActivate(createMockContext());
    await expect(promise).rejects.toThrow(ForbiddenException);
  });

  it('ForbiddenException contains FEATURE_NOT_ENABLED error code', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('chatbot');
    featureFlagsService.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(createMockContext())).rejects.toMatchObject({
      response: {
        statusCode: 403,
        error: 'FEATURE_NOT_ENABLED',
      },
    });
  });

  it('throws ForbiddenException when feature is enabled but NOT licensed (isEnabled returns false)', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('ratings');
    // isEnabled checks both flag.enabled AND license — returns false if either is false
    featureFlagsService.isEnabled.mockResolvedValue(false);

    await expect(guard.canActivate(createMockContext())).rejects.toThrow(ForbiddenException);
  });

  it('checks the correct feature key from decorator metadata', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce('departments');
    featureFlagsService.isEnabled.mockResolvedValue(true);

    await guard.canActivate(createMockContext());

    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith('departments');
  });

  it('does not call isEnabled for public routes even if @RequireFeature is set', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(true); // IS_PUBLIC_KEY → true (short-circuits)

    const result = await guard.canActivate(createMockContext());

    expect(result).toBe(true);
    expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
  });
});
