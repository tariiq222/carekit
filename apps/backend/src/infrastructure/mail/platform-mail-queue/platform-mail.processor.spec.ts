import type { Job } from 'bullmq';
import { PlatformMailProcessor } from './platform-mail.processor';
import type { PrismaService } from '../../database';
import type { BullMqService } from '../../queue/bull-mq.service';
import type { ResendSenderService } from './resend-sender.service';
import type { PlatformMailJobData } from './platform-mail-queue.types';

function buildJob(overrides: Partial<Job<PlatformMailJobData>> = {}): Job<PlatformMailJobData> {
  return {
    id: 'job_1',
    attemptsMade: 0,
    data: {
      logId: 'log_1',
      recipient: 'owner@example.com',
      templateName: 'tenant-welcome',
      subject: 'Welcome',
      html: '<p>hi</p>',
      from: 'Deqah <noreply@webvue.pro>',
    },
    ...overrides,
  } as Job<PlatformMailJobData>;
}

function buildPrisma(): { prisma: PrismaService; updateMock: jest.Mock } {
  const updateMock = jest.fn(async ({ data }: { data: unknown }) => ({ ...(data as object) }));
  const prisma = {
    platformMailDeliveryLog: { update: updateMock },
  } as unknown as PrismaService;
  return { prisma, updateMock };
}

function buildSender(sendImpl?: jest.Mock): { sender: ResendSenderService; sendMock: jest.Mock } {
  const sendMock = sendImpl ?? jest.fn(async () => ({ id: 'msg_1' }));
  const sender = { send: sendMock } as unknown as ResendSenderService;
  return { sender, sendMock };
}

const noopBullmq = {
  createWorker: jest.fn(),
} as unknown as BullMqService;

describe('PlatformMailProcessor.process', () => {
  it('on success: calls Resend then updates log to SENT with sentAt + attempt', async () => {
    const { prisma, updateMock } = buildPrisma();
    const { sender, sendMock } = buildSender();
    const proc = new PlatformMailProcessor(noopBullmq, prisma, sender);

    await proc.process(buildJob({ attemptsMade: 0 }));

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      to: 'owner@example.com',
      from: 'Deqah <noreply@webvue.pro>',
      subject: 'Welcome',
      html: '<p>hi</p>',
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    const updateArg = updateMock.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'log_1' });
    expect(updateArg.data).toMatchObject({
      status: 'SENT',
      attempt: 1,
      errorMessage: null,
    });
    expect(updateArg.data.sentAt).toBeInstanceOf(Date);
  });

  it('records correct attempt number on retries (attemptsMade + 1)', async () => {
    const { prisma, updateMock } = buildPrisma();
    const { sender } = buildSender();
    const proc = new PlatformMailProcessor(noopBullmq, prisma, sender);

    await proc.process(buildJob({ attemptsMade: 3 }));

    expect(updateMock.mock.calls[0][0].data.attempt).toBe(4);
  });

  it('on failure: updates log FAILED + errorMessage and re-throws so BullMQ retries', async () => {
    const { prisma, updateMock } = buildPrisma();
    const sendMock = jest.fn(async () => {
      throw new Error('Resend 500');
    });
    const { sender } = buildSender(sendMock);
    const proc = new PlatformMailProcessor(noopBullmq, prisma, sender);

    await expect(proc.process(buildJob({ attemptsMade: 1 }))).rejects.toThrow('Resend 500');

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].data).toMatchObject({
      status: 'FAILED',
      errorMessage: 'Resend 500',
      attempt: 2,
    });
  });

  it('still re-throws even if the FAILED log update itself fails', async () => {
    const updateMock = jest.fn(async () => {
      throw new Error('db down');
    });
    const prisma = {
      platformMailDeliveryLog: { update: updateMock },
    } as unknown as PrismaService;
    const sendMock = jest.fn(async () => {
      throw new Error('Resend 500');
    });
    const { sender } = buildSender(sendMock);
    const proc = new PlatformMailProcessor(noopBullmq, prisma, sender);

    await expect(proc.process(buildJob({ attemptsMade: 0 }))).rejects.toThrow('Resend 500');
    expect(updateMock).toHaveBeenCalledTimes(1);
  });
});
