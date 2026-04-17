import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { VerifyOtpHandler } from './verify-otp.handler';
import { OtpSessionService } from './otp-session.service';
import { PrismaService } from '../../../infrastructure/database';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

describe('VerifyOtpHandler', () => {
  let handler: VerifyOtpHandler;
  let otpSession: jest.Mocked<OtpSessionService>;

  const mockPrisma = {
    otpCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    client: {
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyOtpHandler,
        { provide: OtpSessionService, useValue: { signSession: jest.fn().mockResolvedValue('mock-token') } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<VerifyOtpHandler>(VerifyOtpHandler);
    otpSession = module.get(OtpSessionService);
  });

  it('should throw BadRequestException when no OTP found', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue(null);
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      code: '123456',
      purpose: OtpPurpose.GUEST_BOOKING,
    })).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when max attempts exceeded', async () => {
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      attempts: 5,
      codeHash: await bcrypt.hash('123456', 10),
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
      createdAt: new Date(),
    });
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      code: '123456',
      purpose: OtpPurpose.GUEST_BOOKING,
    })).rejects.toThrow(BadRequestException);
  });

  it('should throw UnauthorizedException for wrong code', async () => {
    const wrongHash = await bcrypt.hash('000000', 10);
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      codeHash: wrongHash,
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
      createdAt: new Date(),
    });
    mockPrisma.otpCode.update.mockResolvedValue({} as never);
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      code: '123456',
      purpose: OtpPurpose.GUEST_BOOKING,
    })).rejects.toThrow(UnauthorizedException);
  });

  it('should return session token on valid OTP', async () => {
    const correctCode = '123456';
    const correctHash = await bcrypt.hash(correctCode, 10);
    mockPrisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      codeHash: correctHash,
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      expiresAt: new Date(Date.now() + 60000),
      consumedAt: null,
      createdAt: new Date(),
    });
    mockPrisma.otpCode.update.mockResolvedValue({} as never);
    mockPrisma.client.updateMany.mockResolvedValue({ count: 0 });

    const result = await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      code: correctCode,
      purpose: OtpPurpose.GUEST_BOOKING,
    });

    expect(result).toEqual({ sessionToken: 'mock-token' });
    expect(otpSession.signSession).toHaveBeenCalledWith({
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
    });
  });
});
