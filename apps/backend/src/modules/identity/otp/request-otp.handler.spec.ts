import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
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
  let prismaMock: any;

  const mockChannel = {
    kind: OtpChannel.EMAIL,
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    captchaVerifyMock = jest.fn().mockResolvedValue(true);
    otpCountMock = jest.fn().mockResolvedValue(0);

    prismaMock = {
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
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ClsService,
          useValue: {
            run: jest.fn().mockImplementation((fn) => fn()),
            set: jest.fn(),
          },
        },
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

  it('should return success on valid request', async () => {
    const result = await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    });
    expect(result).toEqual({ success: true });
  });

  it('persists organizationId when provided', async () => {
    const orgId = 'org-123';
    const txMock = {
      otpCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

    await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
      organizationId: orgId,
    });

    expect(txMock.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: orgId }),
      }),
    );
    expect(otpCountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: orgId }),
      }),
    );
  });

  it('defaults organizationId to null when omitted', async () => {
    const txMock = {
      otpCode: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => fn(txMock));

    await handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
    });

    expect(txMock.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: null }),
      }),
    );
  });

  it('rate-limit is per-org', async () => {
    // Org A is at cap
    otpCountMock.mockImplementation(({ where }) => {
      if (where.organizationId === 'org-A') return Promise.resolve(5);
      return Promise.resolve(0);
    });

    // Request for Org B should succeed
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
      organizationId: 'org-B',
    })).resolves.toEqual({ success: true });

    // Request for Org A should fail
    await expect(handler.execute({
      channel: OtpChannel.EMAIL,
      identifier: 'test@example.com',
      purpose: OtpPurpose.GUEST_BOOKING,
      hCaptchaToken: 'valid-token',
      organizationId: 'org-A',
    })).rejects.toThrow(HttpException);
  });
});
