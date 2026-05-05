import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { OtpPurpose } from '@prisma/client';
import { VerifyDashboardOtpHandler } from './verify-dashboard-otp.handler';
import { TokenService } from '../shared/token.service';
import { PrismaService } from '../../../infrastructure/database';

const RAW_CODE = '123456';
let CODE_HASH: string;

beforeAll(async () => {
  CODE_HASH = await bcrypt.hash(RAW_CODE, 10);
});

const makeOtpRecord = (overrides: Partial<Record<string, any>> = {}) => ({
  id: 'otp-1',
  identifier: 'user@example.com',
  purpose: OtpPurpose.DASHBOARD_LOGIN,
  codeHash: CODE_HASH,
  channel: 'EMAIL',
  consumedAt: null,
  expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min future
  lockedUntil: null,
  attempts: 0,
  maxAttempts: 5,
  createdAt: new Date(),
  ...overrides,
});

const mockUser = {
  id: 'user-1',
  email: 'user@example.com',
  phone: null,
  name: 'Test User',
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'ADMIN',
  isSuperAdmin: false,
  lastActiveOrganizationId: null,
  customRole: null,
};

const mockMembership = {
  id: 'mem-1',
  organizationId: 'org-1',
  role: 'ADMIN',
};

const mockTokenPair = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

describe('VerifyDashboardOtpHandler', () => {
  let handler: VerifyDashboardOtpHandler;
  let prismaMock: any;
  let tokenService: jest.Mocked<TokenService>;

  beforeEach(async () => {
    prismaMock = {
      otpCode: {
        findFirst: jest.fn().mockResolvedValue(makeOtpRecord()),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(mockUser),
      },
      membership: {
        findMany: jest.fn().mockResolvedValue([mockMembership]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyDashboardOtpHandler,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: TokenService,
          useValue: {
            issueTokenPair: jest.fn().mockResolvedValue(mockTokenPair),
          },
        },
      ],
    }).compile();

    handler = module.get<VerifyDashboardOtpHandler>(VerifyDashboardOtpHandler);
    tokenService = module.get(TokenService);
  });

  it('happy path email → returns AuthResponse with TokenPair, marks otp consumed', async () => {
    const result = await handler.execute({ identifier: 'User@Example.COM', code: RAW_CODE });

    // Token pair is returned
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.expiresIn).toBe(900);

    // User shape is returned
    expect(result.user.email).toBe('user@example.com');
    expect(result.user.isActive).toBe(true);
    expect(result.user.organizationId).toBe('org-1');

    // OTP marked as consumed
    expect(prismaMock.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );

    // Token issued with correct membership context
    expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      expect.objectContaining({
        organizationId: 'org-1',
        membershipId: 'mem-1',
        membershipRole: 'ADMIN',
      }),
    );
  });

  it('no OTP record → throws BadRequestException with "Invalid or expired code"', async () => {
    prismaMock.otpCode.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ identifier: 'user@example.com', code: RAW_CODE })).rejects.toThrow(
      BadRequestException,
    );
    await expect(handler.execute({ identifier: 'user@example.com', code: RAW_CODE })).rejects.toMatchObject({
      message: 'Invalid or expired code',
    });
  });

  it('expired OTP → throws BadRequestException with "Invalid or expired code"', async () => {
    prismaMock.otpCode.findFirst.mockResolvedValue(
      makeOtpRecord({ expiresAt: new Date(Date.now() - 1000) }), // 1 second in the past
    );

    await expect(handler.execute({ identifier: 'user@example.com', code: RAW_CODE })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('wrong code → increments attempts; throws UnauthorizedException; on maxAttempts sets lockedUntil', async () => {
    // Set up: attempts = 4, maxAttempts = 5 → next wrong attempt should lock
    prismaMock.otpCode.findFirst.mockResolvedValue(makeOtpRecord({ attempts: 4, maxAttempts: 5 }));

    await expect(handler.execute({ identifier: 'user@example.com', code: 'wrong1' })).rejects.toThrow(
      UnauthorizedException,
    );

    // Should update attempts AND set lockedUntil (since 4+1 >= 5)
    expect(prismaMock.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp-1' },
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lockedUntil: expect.any(Date),
        }),
      }),
    );
  });

  it('wrong code with attempts < maxAttempts-1 → increments attempts only, no lockedUntil', async () => {
    prismaMock.otpCode.findFirst.mockResolvedValue(makeOtpRecord({ attempts: 0, maxAttempts: 5 }));

    await expect(handler.execute({ identifier: 'user@example.com', code: 'wrong1' })).rejects.toThrow(
      UnauthorizedException,
    );

    // Should increment attempts but NOT set lockedUntil
    expect(prismaMock.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ lockedUntil: expect.anything() }),
      }),
    );
  });

  it('locked OTP (lockedUntil > now) → throws BadRequestException with OTP_LOCKED_OUT', async () => {
    prismaMock.otpCode.findFirst.mockResolvedValue(
      makeOtpRecord({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) }), // 10 min in future
    );

    await expect(handler.execute({ identifier: 'user@example.com', code: RAW_CODE })).rejects.toMatchObject({
      message: 'OTP_LOCKED_OUT',
    });
  });

  it('inactive user → throws UnauthorizedException with "Account is inactive"', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ ...mockUser, isActive: false });

    await expect(handler.execute({ identifier: 'user@example.com', code: RAW_CODE })).rejects.toMatchObject({
      message: 'Account is inactive',
    });
  });
});
