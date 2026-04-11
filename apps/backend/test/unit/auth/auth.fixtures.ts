/**
 * Shared fixtures and mock factories for AuthService test suites.
 */
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export function createMockPrisma(): any {
  return {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    otpCode: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    userRole: { create: jest.fn() },
    role: { findFirst: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

export function createMockJwt() {
  return {
    sign: jest.fn().mockReturnValue('mocked-jwt-token'),
    verify: jest.fn(),
    decode: jest.fn().mockReturnValue(null),
  };
}

export function createMockConfig() {
  return {
    get: jest.fn((key: string) => {
      const config: Record<string, string | number> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRES_IN: '900',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRES_IN: '604800',
        OTP_EXPIRY_MINUTES: '10',
      };
      return config[key];
    }),
  };
}

export function createMockEmail() {
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockAuthCache() {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    invalidate: jest.fn().mockResolvedValue(undefined),
    acquirePopulateLock: jest.fn().mockResolvedValue(true),
    releasePopulateLock: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockWalkIn() {
  return {
    findWalkInByPhone: jest.fn().mockResolvedValue(null),
    claimAccount: jest.fn(),
  };
}

export const mockPatientRole = {
  id: 'patient-role-id',
  slug: 'patient',
  isDefault: true,
};

export const mockCreatedUser = (
  email: string,
  firstName: string,
  lastName: string,
) => ({
  id: 'new-user-id',
  email,
  passwordHash: '$2b$10$hashedpassword',
  firstName,
  lastName,
  isActive: true,
  emailVerified: false,
});
