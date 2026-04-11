import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureGuard } from './feature.guard';

const makeCtx = (user: object | undefined, feature: string | undefined) => {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(feature);

  return {
    reflector,
    ctx: {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext,
  };
};

describe('FeatureGuard', () => {
  it('returns true when no feature required', () => {
    const { reflector, ctx } = makeCtx({ features: [] }, undefined);
    expect(new FeatureGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('returns true when user has the required feature', () => {
    const { reflector, ctx } = makeCtx({ features: ['chatbot'] }, 'chatbot');
    expect(new FeatureGuard(reflector).canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when feature is missing', () => {
    const { reflector, ctx } = makeCtx({ features: ['reports'] }, 'chatbot');
    expect(() => new FeatureGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no user', () => {
    const { reflector, ctx } = makeCtx(undefined, 'chatbot');
    expect(() => new FeatureGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('treats missing features array as empty', () => {
    const { reflector, ctx } = makeCtx({ features: undefined }, 'chatbot');
    expect(() => new FeatureGuard(reflector).canActivate(ctx)).toThrow(ForbiddenException);
  });
});
