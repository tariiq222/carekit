import * as crypto from 'crypto';
/**
 * Shared helpers for auth E2E test suites.
 * Import from here instead of duplicating across spec files.
 */
import request from 'supertest';
import { PrismaService } from '../../../src/database/prisma.service.js';
import { API_PREFIX } from '../setup/setup.js';

const AUTH_URL = `${API_PREFIX}/auth`;

/** Extract refresh_token value from Set-Cookie header */
export function extractCookieToken(cookieHeader: string[]): string {
  const entry = cookieHeader.find((c: string) =>
    c.startsWith('refresh_token='),
  );
  if (!entry)
    throw new Error('refresh_token cookie not found in Set-Cookie header');
  return entry.split(';')[0].replace('refresh_token=', '');
}

export interface FreshUser {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
}

/** Register a fresh user with a unique suffix and return tokens + userId */
export async function registerFresh(
  httpServer: unknown,
  suffix: string,
): Promise<FreshUser> {
  const email = `auth-${suffix}@carekit-test.com`;
  const password = 'T3st@P@ss!99';

  const res = await request(httpServer as Parameters<typeof request>[0])
    .post(`${AUTH_URL}/register`)
    .send({
      email,
      password,
      firstName: 'اختبار',
      lastName: 'عميق',
      phone: `+9668${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      gender: 'male',
    })
    .expect(201);

  const refreshToken = extractCookieToken(
    res.headers['set-cookie'] as string[],
  );

  return {
    email,
    password,
    accessToken: res.body.data.accessToken as string,
    refreshToken,
    userId: res.body.data.user.id as string,
  };
}

/**
 * Creates a known OTP in the DB (hashed, as OtpService does) and returns the plain code.
 * The OTP service stores SHA256(code) in DB, so verify(plain) computes SHA256(plain) to match.
 * This helper inserts SHA256('999999') so tests can send '999999' to verify endpoints.
 */
export async function getLatestOtp(
  prisma: PrismaService,
  userId: string,
  type: 'login' | 'reset_password' | 'verify_email',
): Promise<string> {
  const plainCode = '999999';
  const hashedCode = crypto
    .createHash('sha256')
    .update(plainCode)
    .digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Invalidate existing OTPs (mirrors OtpService.generateOtp behaviour)
  await prisma.otpCode.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.otpCode.create({
    data: { userId, code: hashedCode, type, expiresAt },
  });

  return plainCode;
}
