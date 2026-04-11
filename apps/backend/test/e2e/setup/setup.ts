/**
 * CareKit — E2E Test Infrastructure
 *
 * Provides helpers for bootstrapping the NestJS app,
 * creating test users with specific roles, and managing auth tokens.
 *
 * Usage:
 *   const { app, httpServer } = await createTestApp();
 *   const { user, accessToken, refreshToken } = await createTestUser(app, 'patient');
 *   const headers = getAuthHeaders(accessToken);
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import Redis from 'ioredis';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AppModule } from '../../../src/app.module';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const API_PREFIX = '/api/v1';

/** Default roles seeded in the database */
export const DEFAULT_ROLES = [
  'super_admin',
  'admin',
  'receptionist',
  'accountant',
  'practitioner',
  'patient',
] as const;

export type DefaultRole = (typeof DEFAULT_ROLES)[number];

/** 18 permission modules x 4 actions = 72 permissions */
export const PERMISSION_MODULES = [
  'users',
  'roles',
  'practitioners',
  'bookings',
  'services',
  'payments',
  'invoices',
  'reports',
  'notifications',
  'chatbot',
  'whitelabel',
  'patients',
  'ratings',
  'coupons',
  'branches',
  'intake_forms',
  'activity-log',
] as const;

export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;

export const TOTAL_PERMISSIONS =
  PERMISSION_MODULES.length * PERMISSION_ACTIONS.length; // 72

// ---------------------------------------------------------------------------
// Test user data — realistic Saudi clinic data
// ---------------------------------------------------------------------------

export interface TestUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender: 'male' | 'female';
}

export const TEST_USERS: Record<DefaultRole, TestUserData> = {
  super_admin: {
    email: 'admin@carekit-test.com',
    password: 'Adm!nP@ss123',
    firstName: 'عبدالله',
    lastName: 'الغامدي',
    phone: '+966501000001',
    gender: 'male',
  },
  receptionist: {
    email: 'reception@carekit-test.com',
    password: 'Recept!0nP@ss',
    firstName: 'نورة',
    lastName: 'القحطاني',
    phone: '+966501000002',
    gender: 'female',
  },
  accountant: {
    email: 'accountant@carekit-test.com',
    password: 'Acc0unt@ntP@ss',
    firstName: 'سعد',
    lastName: 'العتيبي',
    phone: '+966501000003',
    gender: 'male',
  },
  practitioner: {
    email: 'doctor@carekit-test.com',
    password: 'D0ct0rP@ss!',
    firstName: 'خالد',
    lastName: 'الفهد',
    phone: '+966501000004',
    gender: 'male',
  },
  patient: {
    email: 'patient@carekit-test.com',
    password: 'P@tientP@ss1',
    firstName: 'أحمد',
    lastName: 'الراشد',
    phone: '+966501000005',
    gender: 'male',
  },
};

/** A second patient for testing ownership boundaries */
export const TEST_PATIENT_2: TestUserData = {
  email: 'patient2@carekit-test.com',
  password: 'P@tient2P@ss1',
  firstName: 'فاطمة',
  lastName: 'الحربي',
  phone: '+966501000006',
  gender: 'female',
};

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

export interface TestApp {
  app: INestApplication;
  httpServer: ReturnType<INestApplication['getHttpServer']>;
  module: TestingModule;
}

/**
 * Creates and initialises the full NestJS application for e2e testing.
 * The app is configured with the same pipes, filters, and prefixes
 * as the production app.
 */
export async function createTestApp(): Promise<TestApp> {
  // Flush Redis throttle counters before each suite so back-to-back suites
  // don't hit the rate limit (counters accumulate across app restarts).
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl, { lazyConnect: true });
  try {
    await redis.connect();
    await redis.flushdb();
  } catch {
    // Non-fatal — throttle may still work or be over-counted
  } finally {
    await redis.quit();
  }

  // Clean booking-related records between suites to prevent time-slot conflicts.
  // Multiple suites create bookings for the same practitioner at the same time slot.
  const connectionString = process.env['DATABASE_URL'];
  if (connectionString) {
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });
    try {
      await prisma.invoice.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.booking.deleteMany({});
      await prisma.notification.deleteMany({});
    } finally {
      await prisma.$disconnect();
    }
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  // Enable rawBody so webhook HMAC signature tests work (mirrors production bootstrap)
  const app = moduleFixture.createNestApplication({ rawBody: true });

  // Match production configuration
  app.use(helmet());
  // Set Permissions-Policy header (not natively supported by this helmet version)
  app.use(
    (
      _req: unknown,
      res: import('express').Response,
      next: import('express').NextFunction,
    ) => {
      res.setHeader('Permissions-Policy', '');
      next();
    },
  );
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return {
    app,
    httpServer: app.getHttpServer(),
    module: moduleFixture,
  };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export interface AuthResult {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
}

/**
 * Registers a new patient via POST /api/v1/auth/register.
 * Returns the user object and auth tokens.
 */
export async function registerTestPatient(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  data: TestUserData = TEST_USERS.patient,
): Promise<AuthResult> {
  const res = await request(httpServer)
    .post(`${API_PREFIX}/auth/register`)
    .send({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      gender: data.gender,
    });

  if (res.status === 201) {
    return {
      user: res.body.data.user,
      accessToken: res.body.data.accessToken,
      refreshToken: res.body.data.refreshToken,
    };
  }

  // User already exists from another test suite — just login
  // 409 = explicit conflict, 500 = Prisma unique constraint error
  if (res.status === 409 || res.status === 500) {
    return loginTestUser(httpServer, data.email, data.password);
  }

  throw new Error(
    `Failed to register test patient ${data.email}: ${res.status} ${JSON.stringify(res.body)}`,
  );
}

/**
 * Logs in a user via POST /api/v1/auth/login.
 * The user must already exist in the database.
 */
export async function loginTestUser(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  email: string,
  password: string,
): Promise<AuthResult> {
  const res = await request(httpServer)
    .post(`${API_PREFIX}/auth/login`)
    .send({ email, password })
    .expect(200);

  return {
    user: res.body.data.user,
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
  };
}

/**
 * Creates a user with a specific role via the admin API.
 * Requires a super_admin access token.
 * For patients, use registerTestPatient instead.
 */
export async function createTestUserWithRole(
  httpServer: ReturnType<INestApplication['getHttpServer']>,
  adminToken: string,
  data: TestUserData,
  roleSlug: string,
): Promise<AuthResult> {
  // Create user via admin endpoint (tolerate 409 if user already exists from another test suite)
  const res = await request(httpServer)
    .post(`${API_PREFIX}/users`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      gender: data.gender,
      roleSlug,
    });

  // 201 = created, 409 = already exists (conflict), 500 = Prisma unique constraint
  if (res.status !== 201 && res.status !== 409 && res.status !== 500) {
    throw new Error(
      `Failed to create test user ${data.email}: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  // Login as the user to get tokens
  return loginTestUser(httpServer, data.email, data.password);
}

/**
 * Returns the Authorization header object for supertest requests.
 */
export function getAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Response shape validators
// ---------------------------------------------------------------------------

/**
 * Asserts that a response body matches the standard success format.
 */
export function expectSuccessResponse(body: Record<string, unknown>): void {
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');
}

/**
 * Asserts that a response body matches the standard error format.
 */
export function expectErrorResponse(
  body: Record<string, unknown>,
  expectedCode: string,
): void {
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('error');
  const error = body.error as Record<string, unknown>;
  expect(error).toHaveProperty('code', expectedCode);
  expect(error).toHaveProperty('message');
  expect(typeof error.message).toBe('string');
}

/**
 * Asserts that a validation error response has the correct shape
 * and includes the expected field names.
 */
export function expectValidationError(
  body: Record<string, unknown>,
  expectedFields: string[],
): void {
  expectErrorResponse(body, 'VALIDATION_ERROR');
  const error = body.error as Record<string, unknown>;
  expect(error).toHaveProperty('details');
  const details = error.details as Array<{ field: string; message: string }>;
  expect(Array.isArray(details)).toBe(true);

  const fieldNames = details.map((d) => d.field);
  for (const field of expectedFields) {
    expect(fieldNames).toContain(field);
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Gracefully closes the NestJS application and its connections.
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}
