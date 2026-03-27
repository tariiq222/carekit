/**
 * Unit tests for JwtAuthGuard and PermissionsGuard.
 *
 * Covers:
 * - JwtAuthGuard: public route bypass, token validation, error shape
 * - PermissionsGuard: no permissions (pass-through), missing user (403),
 *   user not in DB (403), missing permission (403), all permissions match (true),
 *   multi-permission AND logic, multiple roles union
 */

import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../src/modules/auth/decorators/public.decorator.js';
import { PERMISSIONS_KEY } from '../../../src/modules/auth/decorators/check-permissions.decorator.js';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../src/modules/auth/guards/permissions.guard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContext(overrides: {
  isPublic?: boolean;
  user?: { id: string; email: string } | null;
} = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: overrides.user ?? undefined }),
    }),
  } as unknown as ExecutionContext;
}

function buildReflector(meta: { isPublic?: boolean; permissions?: unknown[] } = {}): Reflector {
  return {
    getAllAndOverride: (_key: string) => {
      if (_key === IS_PUBLIC_KEY) return meta.isPublic ?? false;
      if (_key === PERMISSIONS_KEY) return meta.permissions ?? undefined;
      return undefined;
    },
  } as unknown as Reflector;
}

function buildPrisma(dbUser: unknown) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(dbUser),
    },
  };
}

// ---------------------------------------------------------------------------
// JwtAuthGuard
// ---------------------------------------------------------------------------

describe('JwtAuthGuard', () => {
  let reflector: Reflector;

  describe('canActivate — public routes', () => {
    it('returns true immediately for @Public() routes without calling super', () => {
      reflector = buildReflector({ isPublic: true });
      const guard = new JwtAuthGuard(reflector);
      const ctx = buildContext();

      // Override super.canActivate to detect if it was called
      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockReturnValue(false);

      const result = guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(superSpy).not.toHaveBeenCalled();

      superSpy.mockRestore();
    });

    it('delegates to super.canActivate for non-public routes', () => {
      reflector = buildReflector({ isPublic: false });
      const guard = new JwtAuthGuard(reflector);
      const ctx = buildContext();

      const superSpy = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(ctx);

      expect(superSpy).toHaveBeenCalledWith(ctx);
      expect(result).toBe(true);

      superSpy.mockRestore();
    });
  });

  describe('handleRequest', () => {
    it('returns the user when err is null and user is present', () => {
      reflector = buildReflector();
      const guard = new JwtAuthGuard(reflector);
      const user = { id: '1', email: 'a@b.com' };

      const result = guard.handleRequest<typeof user>(null, user);

      expect(result).toBe(user);
    });

    it('throws UnauthorizedException when err is provided', () => {
      reflector = buildReflector();
      const guard = new JwtAuthGuard(reflector);

      expect(() => guard.handleRequest(new Error('jwt expired'), null)).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is null/undefined', () => {
      reflector = buildReflector();
      const guard = new JwtAuthGuard(reflector);

      expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
    });

    it('error body contains AUTH_TOKEN_INVALID code', () => {
      reflector = buildReflector();
      const guard = new JwtAuthGuard(reflector);

      try {
        guard.handleRequest(null, null);
        fail('should have thrown');
      } catch (e) {
        expect((e as UnauthorizedException).getResponse()).toMatchObject({
          error: 'AUTH_TOKEN_INVALID',
          statusCode: 401,
        });
      }
    });
  });
});

// ---------------------------------------------------------------------------
// PermissionsGuard
// ---------------------------------------------------------------------------

describe('PermissionsGuard', () => {
  function makeGuard(
    permissions: unknown[] | undefined,
    dbUser: unknown,
    reqUser?: { id: string; email: string } | null,
  ) {
    const reflector = buildReflector({ permissions });
    const prisma = buildPrisma(dbUser);
    const guard = new PermissionsGuard(reflector as Reflector, prisma as never);
    const ctx = buildContext({ user: reqUser ?? { id: 'u1', email: 'x@y.com' } });
    return { guard, ctx, prisma };
  }

  it('returns true when no permissions are required (pass-through)', async () => {
    const { guard, ctx } = makeGuard(undefined, null);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('returns true when permissions array is empty', async () => {
    const { guard, ctx } = makeGuard([], null);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws ForbiddenException when request has no user', async () => {
    const reflector = buildReflector({ permissions: [{ module: 'users', action: 'view' }] });
    const prisma = buildPrisma(null);
    const guard = new PermissionsGuard(reflector as Reflector, prisma as never);
    const ctx = buildContext({ user: null });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user not found in DB', async () => {
    const { guard, ctx } = makeGuard(
      [{ module: 'users', action: 'view' }],
      null, // DB returns null
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user lacks required permission', async () => {
    const dbUser = {
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { module: 'patients', action: 'view' } },
            ],
          },
        },
      ],
    };

    const { guard, ctx } = makeGuard(
      [{ module: 'users', action: 'delete' }], // requires users:delete
      dbUser,
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('returns true when user has the required permission', async () => {
    const dbUser = {
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { module: 'users', action: 'view' } },
            ],
          },
        },
      ],
    };

    const { guard, ctx } = makeGuard(
      [{ module: 'users', action: 'view' }],
      dbUser,
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('requires ALL permissions (AND logic) — fails if one is missing', async () => {
    const dbUser = {
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { module: 'users', action: 'view' } },
              // missing users:delete
            ],
          },
        },
      ],
    };

    const { guard, ctx } = makeGuard(
      [
        { module: 'users', action: 'view' },
        { module: 'users', action: 'delete' },
      ],
      dbUser,
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('grants access when user has permissions from multiple roles (union)', async () => {
    const dbUser = {
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { module: 'users', action: 'view' } },
            ],
          },
        },
        {
          role: {
            rolePermissions: [
              { permission: { module: 'users', action: 'delete' } },
            ],
          },
        },
      ],
    };

    const { guard, ctx } = makeGuard(
      [
        { module: 'users', action: 'view' },
        { module: 'users', action: 'delete' },
      ],
      dbUser,
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('error body contains FORBIDDEN code', async () => {
    const { guard, ctx } = makeGuard(
      [{ module: 'users', action: 'view' }],
      null,
    );

    try {
      await guard.canActivate(ctx);
      fail('should have thrown');
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        error: 'FORBIDDEN',
        statusCode: 403,
      });
    }
  });

  it('DB query uses correct user id from request', async () => {
    const dbUser = {
      userRoles: [
        {
          role: {
            rolePermissions: [
              { permission: { module: 'reports', action: 'view' } },
            ],
          },
        },
      ],
    };

    const reflector = buildReflector({ permissions: [{ module: 'reports', action: 'view' }] });
    const prisma = buildPrisma(dbUser);
    const guard = new PermissionsGuard(reflector as Reflector, prisma as never);
    const ctx = buildContext({ user: { id: 'specific-user-id', email: 'x@y.com' } });

    await guard.canActivate(ctx);

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'specific-user-id' } }),
    );
  });
});
