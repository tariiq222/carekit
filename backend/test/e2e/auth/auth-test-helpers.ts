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
  const entry = cookieHeader.find((c: string) => c.startsWith('refresh_token='));
  if (!entry) throw new Error('refresh_token cookie not found in Set-Cookie header');
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

  const refreshToken = extractCookieToken(res.headers['set-cookie'] as string[]);

  return {
    email,
    password,
    accessToken: res.body.data.accessToken as string,
    refreshToken,
    userId: res.body.data.user.id as string,
  };
}

/** Read the most recent unused OTP for a user+type directly from DB */
export async function getLatestOtp(
  prisma: PrismaService,
  userId: string,
  type: 'login' | 'reset_password' | 'verify_email',
): Promise<string> {
  const otp = await prisma.otpCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { code: true },
  });
  if (!otp) throw new Error(`No active OTP found for userId=${userId} type=${type}`);
  return otp.code;
}
