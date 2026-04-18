import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestOtpHandler } from './request-otp.handler';
import { NotificationChannelRegistry } from '../../comms/notification-channel/notification-channel-registry';
import { PrismaService } from '../../../infrastructure/database';
import { CAPTCHA_VERIFIER } from '../../comms/contact-messages/captcha.verifier';
import { OtpChannel, OtpPurpose } from '@prisma/client';

describe('RequestOtpHandler', () => {
  let handler: RequestOtpHandler;
  let channelRegistry: jest.Mocked<NotificationChannelRegistry>;
  let captchaVerifyMock: jest.Mock;
  let otpCountMock: jest.Mock;

  const mockChannel = {
    kind: OtpChannel.EMAIL,
    send: jest.fn().mockResolvedValue(undefined),
  };

  const buildPrismaMock = (countValue = 0) => ({
    $transaction: jest.fn().mockImplementation(async (fn) => fn({
      otpCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    })),
    otpCode: {
      count: jest.fn().mockResolvedValue(countValue),
    },
  });

  beforeEach(async () => {
    captchaVerifyMock = jest.fn().mockResolvedValue(true);
    otpCountMock = jest.fn().mockResolvedValue(0);

    const mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (fn) => fn({
        otpCode: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({ id: 'test-id' }),
        },
      })),
      otpCode: { count: otpCountMock },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestOtpHandler,
        { provide: NotificationChannelRegistry, useValue: { resolve: jest.fn().mockReturnValue(mockChannel) } },
        { provide: CAPTCHA_VERIFIER, useValue: { verify: captchaVerifyMock } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<RequestOtpHandler>(RequestOtpHandler);
    channelRegistry = module.get(NotificationChannelRegistry);
  });

  it('should throw BadRequestException when captcha is invalid', async () => {
    captchaVerifyMock.mockResolvedValue(false);
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'invalid',
    })).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException for invalid email format', async () => {
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'not-an-email',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    })).rejects.toThrow(BadRequestException);
  });

  it('should return success on valid request', async () => {
    const result = await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    });
    expect(result).toEqual({ success: true });
  });

  it('should send OTP via email channel', async () => {
    await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    });
    expect(channelRegistry.resolve).toHaveBeenCalledWith(OtpChannel.EMAIL);
    expect(mockChannel.send).toHaveBeenCalledWith('test@example.com', expect.any(String));
  });

  it('should throw 429 when per-identifier hourly cap is reached', async () => {
    otpCountMock.mockResolvedValue(5);
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    })).rejects.toThrow(HttpException);
  });

  it('should allow request when count is below cap', async () => {
    otpCountMock.mockResolvedValue(4);
    const result = await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    });
    expect(result).toEqual({ success: true });
  });
});
