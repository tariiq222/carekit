import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { RegisterHandler } from './register.handler';
import { PrismaService } from '../../../infrastructure/database';
import { OtpSessionService } from '../otp/otp-session.service';
import { ClientTokenService } from '../shared/client-token.service';
import { PasswordService } from '../shared/password.service';
import { TenantContextService } from '../../../common/tenant';

describe('RegisterHandler', () => {
  let handler: RegisterHandler;

  const mockPrisma = {
    client: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockOtpSession = { verifySession: jest.fn() };
  const mockClientTokens = { issueTokenPair: jest.fn() };
  const mockPasswords = { hash: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OtpSessionService, useValue: mockOtpSession },
        { provide: ClientTokenService, useValue: mockClientTokens },
        { provide: PasswordService, useValue: mockPasswords },
        { provide: TenantContextService, useValue: { requireOrganizationIdOrDefault: () => 'org-test' } },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
  });

  const mockRequest = (auth?: string) =>
    ({ headers: { authorization: auth } }) as any;

  describe('execute', () => {
    it('registers a new client via EMAIL OTP session', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        identifier: 'test@example.com',
        purpose: OtpPurpose.CLIENT_LOGIN,
        channel: OtpChannel.EMAIL,
        jti: 'jti-1',
      });
      mockPrisma.client.findFirst.mockResolvedValue(null);
      mockPasswords.hash.mockResolvedValue('hashed_pw');
      mockPrisma.client.create.mockResolvedValue({ id: 'cl-new' });
      mockClientTokens.issueTokenPair.mockResolvedValue({
        accessToken: 'at', accessMaxAgeMs: 900_000, rawRefresh: 'rt', refreshMaxAgeMs: 604_800_000,
      });

      const result = await handler.execute(
        { password: 'SecurePass123', name: 'Ahmed' },
        mockRequest('Bearer otp-session-token'),
      );

      expect(result.accessToken).toBe('at');
      expect(result.refreshToken).toBe('rt');
      expect(result.clientId).toBe('cl-new');
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-test',
          email: 'test@example.com',
          name: 'Ahmed',
          passwordHash: 'hashed_pw',
          emailVerified: expect.any(Date),
          accountType: 'FULL',
        }),
      });
      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ organizationId: 'org-test', email: 'test@example.com' }),
      });
      expect(mockClientTokens.issueTokenPair).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cl-new' }),
        { organizationId: 'org-test' },
      );
    });

    it('merges guest account when phone already exists', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        identifier: '+966500000001',
        purpose: OtpPurpose.CLIENT_LOGIN,
        channel: OtpChannel.SMS,
        jti: 'jti-2',
      });
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-guest',
        phone: '+966500000001',
        name: 'Guest User',
        passwordHash: null,
      });
      mockPasswords.hash.mockResolvedValue('hashed_pw');
      mockPrisma.client.update.mockResolvedValue({ id: 'cl-guest' });
      mockClientTokens.issueTokenPair.mockResolvedValue({
        accessToken: 'at2', accessMaxAgeMs: 900_000, rawRefresh: 'rt2', refreshMaxAgeMs: 604_800_000,
      });

      const result = await handler.execute(
        { password: 'SecurePass123' },
        mockRequest('Bearer otp-session-token'),
      );

      expect(result.clientId).toBe('cl-guest');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: 'cl-guest' },
        data: expect.objectContaining({
          passwordHash: 'hashed_pw',
          phoneVerified: expect.any(Date),
          accountType: 'FULL',
          claimedAt: expect.any(Date),
        }),
      });
    });

    it('rejects when account already has a password', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        identifier: 'test@example.com',
        purpose: OtpPurpose.CLIENT_LOGIN,
        channel: OtpChannel.EMAIL,
        jti: 'jti-3',
      });
      mockPrisma.client.findFirst.mockResolvedValue({
        id: 'cl-existing',
        email: 'test@example.com',
        passwordHash: 'existing_hash',
      });

      await expect(
        handler.execute(
          { password: 'SecurePass123' },
          mockRequest('Bearer otp-session-token'),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws Unauthorized when no OTP session token provided', async () => {
      await expect(
        handler.execute({ password: 'SecurePass123' }, mockRequest()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when OTP session is invalid', async () => {
      mockOtpSession.verifySession.mockReturnValue(null);

      await expect(
        handler.execute(
          { password: 'SecurePass123' },
          mockRequest('Bearer bad-token'),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when OTP purpose is not CLIENT_LOGIN', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        identifier: 'test@example.com',
        purpose: OtpPurpose.GUEST_BOOKING,
        channel: OtpChannel.EMAIL,
        jti: 'jti-4',
      });

      await expect(
        handler.execute(
          { password: 'SecurePass123' },
          mockRequest('Bearer otp-session-token'),
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
