/**
 * Shared TestingModule factory for AuthService test suites.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { TokenService } from '../token.service.js';
import { OtpService } from '../otp.service.js';
import { EmailService } from '../../email/email.service.js';
import { AuthCacheService } from '../auth-cache.service.js';
import { PatientWalkInService } from '../../patients/patient-walk-in.service.js';
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
      { provide: EmailService, useValue: mockEmail },
      { provide: AuthCacheService, useValue: createMockAuthCache() },
      { provide: PatientWalkInService, useValue: createMockWalkIn() },
    ],
  }).compile();

  return {
    service: module.get<AuthService>(AuthService),
    mockPrisma,
    mockEmail,
  };
}
