import { PlatformMailQueueService } from './platform-mail-queue.service';
import { PLATFORM_MAIL_QUEUE } from './platform-mail-queue.types';
import type { PrismaService } from '../../database';
import type { BullMqService } from '../../queue/bull-mq.service';

type LogRow = {
  id: string;
  jobId: string | null;
  status: string;
  errorMessage: string | null;
};

function buildPrisma(): {
  prisma: PrismaService;
  rows: Map<string, LogRow>;
  createMock: jest.Mock;
  updateMock: jest.Mock;
} {
  const rows = new Map<string, LogRow>();
  let nextId = 1;
  const createMock = jest.fn(async ({ data }: { data: { recipient: string; templateName: string; status: string; attempt: number } }) => {
    const id = `log_${nextId++}`;
    const row: LogRow = { id, jobId: null, status: data.status, errorMessage: null };
    rows.set(id, row);
    return { id, ...data };
  });
  const updateMock = jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<LogRow> }) => {
    const existing = rows.get(where.id);
    if (!existing) throw new Error(`Row ${where.id} not found`);
    Object.assign(existing, data);
    return { ...existing };
  });
  const prisma = {
    platformMailDeliveryLog: { create: createMock, update: updateMock },
  } as unknown as PrismaService;
  return { prisma, rows, createMock, updateMock };
}

function buildBullmq(addImpl?: jest.Mock): {
  bullmq: BullMqService;
  addMock: jest.Mock;
  getQueueMock: jest.Mock;
} {
  const addMock = addImpl ?? jest.fn(async () => ({ id: 'job_xyz' }));
  const getQueueMock = jest.fn(() => ({ add: addMock }));
  const bullmq = { getQueue: getQueueMock } as unknown as BullMqService;
  return { bullmq, addMock, getQueueMock };
}

const PAYLOAD = {
  recipient: 'owner@example.com',
  templateName: 'tenant-welcome',
  subject: 'Welcome to Deqah',
  html: '<p>hi</p>',
  from: 'Deqah <noreply@webvue.pro>',
};

describe('PlatformMailQueueService.enqueue', () => {
  it('creates a QUEUED log row, calls Queue.add with retry+backoff options, then writes jobId back', async () => {
    const { prisma, rows, createMock, updateMock } = buildPrisma();
    const { bullmq, addMock, getQueueMock } = buildBullmq();
    const svc = new PlatformMailQueueService(prisma, bullmq);

    await svc.enqueue(PAYLOAD);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        recipient: PAYLOAD.recipient,
        templateName: PAYLOAD.templateName,
        status: 'QUEUED',
        attempt: 0,
      },
    });

    expect(getQueueMock).toHaveBeenCalledWith(PLATFORM_MAIL_QUEUE);
    expect(addMock).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOpts] = addMock.mock.calls[0];
    expect(jobName).toBe('send');
    expect(jobData).toMatchObject({
      logId: expect.any(String),
      recipient: PAYLOAD.recipient,
      templateName: PAYLOAD.templateName,
      subject: PAYLOAD.subject,
      html: PAYLOAD.html,
      from: PAYLOAD.from,
    });
    expect(jobOpts).toEqual({
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: jobData.logId },
      data: { jobId: 'job_xyz' },
    });

    const stored = rows.get(jobData.logId);
    expect(stored).toBeDefined();
    expect(stored!.jobId).toBe('job_xyz');
  });

  it('does not throw when Queue.add fails — marks log FAILED instead', async () => {
    const { prisma, rows, updateMock } = buildPrisma();
    const addMock = jest.fn(async () => {
      throw new Error('redis down');
    });
    const { bullmq } = buildBullmq(addMock);
    const svc = new PlatformMailQueueService(prisma, bullmq);

    await expect(svc.enqueue(PAYLOAD)).resolves.toBeUndefined();

    // Update should be called with FAILED status
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].data).toMatchObject({
      status: 'FAILED',
      errorMessage: expect.stringContaining('redis down'),
    });

    // Row exists with FAILED status
    const onlyRow = [...rows.values()][0];
    expect(onlyRow.status).toBe('FAILED');
  });

  it('does not throw when DB create fails — logs and returns silently', async () => {
    const createMock = jest.fn(async () => {
      throw new Error('db unreachable');
    });
    const updateMock = jest.fn();
    const prisma = {
      platformMailDeliveryLog: { create: createMock, update: updateMock },
    } as unknown as PrismaService;
    const { bullmq, addMock } = buildBullmq();
    const svc = new PlatformMailQueueService(prisma, bullmq);

    await expect(svc.enqueue(PAYLOAD)).resolves.toBeUndefined();
    // Never enqueued because we couldn't even create the audit row.
    expect(addMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
