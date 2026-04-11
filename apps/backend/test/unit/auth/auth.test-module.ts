/**
 * Shared TestingModule factory for AuthService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../../src/modules/auth/auth.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { TokenService } from '../../../src/modules/auth/token.service.js';
import { OtpService } from '../../../src/modules/auth/otp.service.js';
import { MessagingDispatcherService } from '../../../src/modules/messaging/core/messaging-dispatcher.service.js';
import { AuthCacheService } from '../../../src/modules/auth/auth-cache.service.js';
import { PermissionCacheService } from '../../../src/modules/auth/permission-cache.service.js';
import { PatientWalkInService } from '../../../src/modules/patients/patient-walk-in.service.js';
import {
  createMockPrisma,
  createMockJwt,
  createMockConfig,
  createMockEmail,
  createMockAuthCache,
  createMockWalkIn,
} from './auth.fixtures.js';

export interface AuthTestContext {
  service: AuthService;
  mockPrisma: ReturnType<typeof createMockPrisma>;
  mockEmail: ReturnType<typeof createMockEmail>;
}

export async function createAuthTestModule(): Promise<AuthTestContext> {
  const mockPrisma = createMockPrisma();
  const mockEmail = createMockEmail();

  mockPrisma.$transaction.mockImplementation(
    (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma),
  );

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      TokenService,
      OtpService,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: JwtService, useValue: createMockJwt() },
      { provide: ConfigService, useValue: createMockConfig() },
      { provide: MessagingDispatcherService, useValue: mockEmail },
      { provide: AuthCacheService, useValue: createMockAuthCache() },
      {
        provide: PermissionCacheService,
        useValue: { invalidate: jest.fn().mockResolvedValue(undefined) },
      },
      { provide: PatientWalkInService, useValue: createMockWalkIn() },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    mockPrisma,
    mockEmail,
  };
}
