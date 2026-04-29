import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { RequestEmailVerificationHandler } from './request-email-verification.handler';
import { PrismaService } from '../../../infrastructure/database';
import { SendEmailHandler } from '../../comms/send-email/send-email.handler';
import { TenantContextService } from '../../../common/tenant';

describe('RequestEmailVerificationHandler', () => {
  let handler: RequestEmailVerificationHandler;
  let prisma: {
    user: { findUnique: jest.Mock };
    emailVerificationToken: { deleteMany: jest.Mock; create: jest.Mock };
  };
  let sendEmail: { execute: jest.Mock };
  let config: { get: jest.Mock };
  let tenant: { requireOrganizationId: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      emailVerificationToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    sendEmail = { execute: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue('https://app.carekit.test') };
    tenant = { requireOrganizationId: jest.fn().mockReturnValue('org-current') };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RequestEmailVerificationHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SendEmailHandler, useValue: sendEmail },
        { provide: ConfigService, useValue: config },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();
    handler = moduleRef.get(RequestEmailVerificationHandler);
  });

  it('no-ops when user.emailVerifiedAt already set', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      emailVerifiedAt: new Date(),
    });

    const result = await handler.execute({ userId: 'u1' });

    expect(result).toEqual({ success: true });
    expect(prisma.emailVerificationToken.deleteMany).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(sendEmail.execute).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('rotates tokens (deleteMany then create)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      emailVerifiedAt: null,
    });

    const order: string[] = [];
    prisma.emailVerificationToken.deleteMany.mockImplementation(async () => {
      order.push('delete');
      return { count: 1 };
    });
    prisma.emailVerificationToken.create.mockImplementation(async () => {
      order.push('create');
      return {};
    });

    await handler.execute({ userId: 'u1' });

    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', organizationId: 'org-current' },
    });
    expect(order).toEqual(['delete', 'create']);
  });

  it('uses the current tenant when organizationId is omitted', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      emailVerifiedAt: null,
    });

    await handler.execute({ userId: 'u1' });

    expect(tenant.requireOrganizationId).toHaveBeenCalledTimes(1);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        organizationId: 'org-current',
      }),
    });
  });

  it('inserts token with sha256 hash, 8-char selector, expiry ~30min ahead', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      emailVerifiedAt: null,
    });

    const before = Date.now();
    await handler.execute({ userId: 'u1', organizationId: 'org-1' });
    const after = Date.now();

    expect(tenant.requireOrganizationId).not.toHaveBeenCalled();
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.emailVerificationToken.create.mock.calls[0][0];
    const data = createArgs.data;

    expect(data.userId).toBe('u1');
    expect(data.organizationId).toBe('org-1');
    expect(typeof data.tokenHash).toBe('string');
    expect(data.tokenHash).toHaveLength(64);
    expect(typeof data.tokenSelector).toBe('string');
    expect(data.tokenSelector).toHaveLength(8);
    expect(data.expiresAt).toBeInstanceOf(Date);

    const expiresMs = (data.expiresAt as Date).getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + 30 * 60 * 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + 30 * 60 * 1000);
  });

  it('sends an email with a link that contains the raw token (sha256 matches stored hash)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: 'Alice',
      emailVerifiedAt: null,
    });

    await handler.execute({ userId: 'u1' });

    expect(sendEmail.execute).toHaveBeenCalledTimes(1);
    const sendArgs = sendEmail.execute.mock.calls[0][0];
    expect(sendArgs.to).toBe('a@b.com');
    expect(sendArgs.templateSlug).toBe('user_email_verification');

    const verifyUrl: string = sendArgs.vars.verifyUrl;
    expect(verifyUrl).toContain('https://app.carekit.test/verify-email?token=');
    const rawTokenFromLink = verifyUrl.split('token=')[1];
    expect(rawTokenFromLink).toHaveLength(64);

    const createArgs = prisma.emailVerificationToken.create.mock.calls[0][0];
    const expectedHash = createHash('sha256').update(rawTokenFromLink).digest('hex');
    expect(createArgs.data.tokenHash).toBe(expectedHash);
    expect(createArgs.data.tokenSelector).toBe(rawTokenFromLink.slice(0, 8));
  });
});
