import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { ResetPasswordHandler } from './reset-password.handler';
import { PrismaService } from '../../../../infrastructure/database';
import { OtpSessionService } from '../../otp/otp-session.service';
import { PasswordService } from '../../shared/password.service';

describe('ResetPasswordHandler', () => {
  let handler: ResetPasswordHandler;

  const mockTx = {
    client: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    usedOtpSession: { create: jest.fn() },
    clientRefreshToken: { updateMany: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
  };

  const mockOtpSession = { verifySession: jest.fn() };
  const mockPasswords = { hash: jest.fn() };

  const validSession = {
    identifier: 'user@example.com',
    purpose: OtpPurpose.CLIENT_PASSWORD_RESET,
    channel: OtpChannel.EMAIL,
    jti: 'test-jti-1',
    exp: Math.floor(Date.now() / 1000) + 1800,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OtpSessionService, useValue: mockOtpSession },
        { provide: PasswordService, useValue: mockPasswords },
      ],
    }).compile();

    handler = module.get<ResetPasswordHandler>(ResetPasswordHandler);
  });

  describe('execute', () => {
    it('resets password and revokes refresh tokens on success', async () => {
      mockOtpSession.verifySession.mockReturnValue(validSession);
      mockPasswords.hash.mockResolvedValue('new-hash');
      mockTx.client.findFirst.mockResolvedValue({ id: 'client-1', email: 'user@example.com' });
      mockTx.usedOtpSession.create.mockResolvedValue({});
      mockTx.client.update.mockResolvedValue({});
      mockTx.clientRefreshToken.updateMany.mockResolvedValue({ count: 2 });

      await expect(
        handler.execute({ sessionToken: 'valid-token', newPassword: 'NewPass123' }),
      ).resolves.toBeUndefined();

      expect(mockTx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: expect.objectContaining({ passwordHash: 'new-hash', loginAttempts: 0, lockoutUntil: null }),
      });
      expect(mockTx.clientRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('throws Unauthorized when session token is invalid', async () => {
      mockOtpSession.verifySession.mockReturnValue(null);

      await expect(
        handler.execute({ sessionToken: 'bad-token', newPassword: 'NewPass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when session purpose is not CLIENT_PASSWORD_RESET', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        ...validSession,
        purpose: OtpPurpose.CLIENT_LOGIN,
      });

      await expect(
        handler.execute({ sessionToken: 'token', newPassword: 'NewPass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when client not found for identifier', async () => {
      mockOtpSession.verifySession.mockReturnValue(validSession);
      mockPasswords.hash.mockResolvedValue('new-hash');
      mockTx.client.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute({ sessionToken: 'token', newPassword: 'NewPass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when OTP session jti is already burned (replay)', async () => {
      mockOtpSession.verifySession.mockReturnValue(validSession);
      mockPasswords.hash.mockResolvedValue('new-hash');
      mockTx.client.findFirst.mockResolvedValue({ id: 'client-1', email: 'user@example.com' });
      mockTx.usedOtpSession.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(
        handler.execute({ sessionToken: 'token', newPassword: 'NewPass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('looks up client by phone for SMS channel', async () => {
      mockOtpSession.verifySession.mockReturnValue({
        ...validSession,
        identifier: '+966500000001',
        channel: OtpChannel.SMS,
      });
      mockPasswords.hash.mockResolvedValue('new-hash');
      mockTx.client.findFirst.mockResolvedValue({ id: 'client-2', phone: '+966500000001' });
      mockTx.usedOtpSession.create.mockResolvedValue({});
      mockTx.client.update.mockResolvedValue({});
      mockTx.clientRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      await handler.execute({ sessionToken: 'token', newPassword: 'NewPass123' });

      expect(mockTx.client.findFirst).toHaveBeenCalledWith({
        where: { phone: '+966500000001', deletedAt: null },
      });
    });
  });
});
