/**
 * JwtStrategy — Unit Tests
 * Covers: validate() with valid payload, deactivated user, non-existent user
 */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../../../src/modules/auth/strategies/jwt.strategy.js';
import { TokenService } from '../../../src/modules/auth/token.service.js';
import type { JwtPayload } from '../../../src/modules/auth/types/jwt-payload.type.js';
import type { UserPayload } from '../../../src/common/types/user-payload.type.js';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockTokenService: {
    buildUserPayloadFromId: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  const validPayload: JwtPayload = {
    sub: 'user-uuid-123',
    email: 'patient@example.com',
    iat: 1700000000,
    exp: 1700000900,
  };

  const validUserPayload: UserPayload = {
    id: 'user-uuid-123',
    email: 'patient@example.com',
    firstName: 'Ahmed',
    lastName: 'Al-Rashid',
    phone: null,
    gender: null,
    isActive: true,
    emailVerified: true,
    createdAt: new Date('2024-01-01'),
    roles: [{ id: 'role-1', name: 'Patient', slug: 'patient' }],
    permissions: ['bookings:view', 'bookings:create'],
  };

  beforeEach(async () => {
    mockTokenService = {
      buildUserPayloadFromId: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: mockTokenService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  // ── Constructor ─────────────────────────────────────────────

  it('should throw if JWT_SECRET is not defined', () => {
    mockConfigService.get.mockReturnValue(undefined);

    expect(() => {
      Test.createTestingModule({
        providers: [
          JwtStrategy,
          { provide: ConfigService, useValue: mockConfigService },
          { provide: TokenService, useValue: mockTokenService },
        ],
      });
    }).not.toThrow(); // Module creation is lazy; strategy ctor runs on compile

    // Actually test by creating a new strategy directly
    expect(() => {
      new (JwtStrategy as any)(
        { get: () => undefined } as any,
        mockTokenService as any,
      );
    }).toThrow('JWT_SECRET is not defined');
  });

  // ── validate() — happy path ─────────────────────────────────

  it('should return UserPayload for valid payload', async () => {
    mockTokenService.buildUserPayloadFromId.mockResolvedValue(validUserPayload);

    const result = await strategy.validate(validPayload);

    expect(result).toEqual(validUserPayload);
    expect(mockTokenService.buildUserPayloadFromId).toHaveBeenCalledWith(
      'user-uuid-123',
    );
  });

  it('should pass the sub (userId) to tokenService', async () => {
    mockTokenService.buildUserPayloadFromId.mockResolvedValue(validUserPayload);

    await strategy.validate(validPayload);

    expect(mockTokenService.buildUserPayloadFromId).toHaveBeenCalledTimes(1);
    expect(mockTokenService.buildUserPayloadFromId).toHaveBeenCalledWith(
      validPayload.sub,
    );
  });

  // ── validate() — missing sub ────────────────────────────────

  it('should throw UnauthorizedException when payload has no sub', async () => {
    const invalidPayload = { email: 'test@example.com' } as JwtPayload;

    await expect(strategy.validate(invalidPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw AUTH_TOKEN_INVALID when sub is missing', async () => {
    const invalidPayload = {
      email: 'no-sub@test.com',
    } as unknown as JwtPayload;

    try {
      await strategy.validate(invalidPayload);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      const response = (error as UnauthorizedException).getResponse();
      expect(response).toMatchObject({
        error: 'AUTH_TOKEN_INVALID',
      });
    }
  });

  // ── validate() — deactivated user ───────────────────────────

  it('should throw UnauthorizedException for deactivated user', async () => {
    mockTokenService.buildUserPayloadFromId.mockRejectedValue(
      new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid token',
        error: 'AUTH_TOKEN_INVALID',
      }),
    );

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should wrap service error as AUTH_TOKEN_INVALID', async () => {
    mockTokenService.buildUserPayloadFromId.mockRejectedValue(
      new Error('User account deactivated'),
    );

    try {
      await strategy.validate(validPayload);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      const response = (error as UnauthorizedException).getResponse();
      expect(response).toMatchObject({ error: 'AUTH_TOKEN_INVALID' });
    }
  });

  // ── validate() — non-existent user ──────────────────────────

  it('should throw UnauthorizedException for non-existent user', async () => {
    mockTokenService.buildUserPayloadFromId.mockRejectedValue(
      new UnauthorizedException({
        statusCode: 401,
        message: 'User not found',
        error: 'AUTH_TOKEN_INVALID',
      }),
    );

    await expect(
      strategy.validate({ ...validPayload, sub: 'nonexistent-id' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when tokenService throws generic error', async () => {
    mockTokenService.buildUserPayloadFromId.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(strategy.validate(validPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should not call buildUserPayloadFromId when sub is empty string', async () => {
    // empty string is falsy but exists on payload
    const payloadWithEmptySub = {
      ...validPayload,
      sub: '',
    } as unknown as JwtPayload;

    // sub is empty string — should throw for falsy sub (but '' is not null/undefined)
    // The code checks `!payload.sub` which catches empty string
    await expect(strategy.validate(payloadWithEmptySub)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockTokenService.buildUserPayloadFromId).not.toHaveBeenCalled();
  });
});
