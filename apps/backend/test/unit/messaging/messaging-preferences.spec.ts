import { Test } from '@nestjs/testing';
import { MessagingPreferencesService } from '../../../src/modules/messaging/core/messaging-preferences.service.js';
import { PrismaService } from '../../../src/database/prisma.service.js';

describe('MessagingPreferencesService', () => {
  let service: MessagingPreferencesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingPreferencesService,
        {
          provide: PrismaService,
          useValue: {
            messagingPreference: {
              upsert: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MessagingPreferencesService>(MessagingPreferencesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('returns defaults when no record exists', async () => {
    jest.spyOn(prisma.messagingPreference, 'findUnique').mockResolvedValue(null);
    const result = await service.resolve('user-1');
    expect(result).toEqual({
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      categories: {},
    });
  });

  it('returns stored values when record exists', async () => {
    jest.spyOn(prisma.messagingPreference, 'findUnique').mockResolvedValue({
      pushEnabled: false,
      emailEnabled: true,
      smsEnabled: true,
      categories: { appointment: { push: false } },
    } as any);
    const result = await service.resolve('user-1');
    expect(result.pushEnabled).toBe(false);
    expect(result.categories.appointment.push).toBe(false);
  });

  it('returns false for sms when smsEnabled is false', async () => {
    jest.spyOn(prisma.messagingPreference, 'findUnique').mockResolvedValue({
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      categories: {},
    } as any);
    const result = await service.isChannelEnabled('user-1', 'sms', 'appointment');
    expect(result).toBe(false);
  });

  it('returns true for push when all enabled', async () => {
    jest.spyOn(prisma.messagingPreference, 'findUnique').mockResolvedValue({
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: true,
      categories: { appointment: { push: true } },
    } as any);
    const result = await service.isChannelEnabled('user-1', 'push', 'appointment');
    expect(result).toBe(true);
  });
});
