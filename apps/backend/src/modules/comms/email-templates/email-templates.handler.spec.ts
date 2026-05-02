import { NotFoundException } from '@nestjs/common';
import { CreateEmailTemplateHandler } from './create-email-template.handler';
import { UpdateEmailTemplateHandler } from './update-email-template.handler';
import { GetEmailTemplateHandler } from './get-email-template.handler';
import { ListEmailTemplatesHandler } from './list-email-templates.handler';
import { PreviewEmailTemplateHandler } from './preview-email-template.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  emailTemplate: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    update: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
});

const buildTenant = (organizationId = 'org-A') => ({
  requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
});

// ─── CreateEmailTemplateHandler ──────────────────────────────────────────────
describe('CreateEmailTemplateHandler', () => {
  it('creates an email template tagged with organizationId when slug is free', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    prisma.emailTemplate.create.mockResolvedValueOnce({ id: 'tpl-1', slug: 'welcome' });
    const handler = new CreateEmailTemplateHandler(
      prisma as unknown as PrismaService,
      buildTenant('org-A') as never,
    );
    const result = await handler.execute({
      slug: 'welcome',
      name: 'ترحيب',
      subject: 'مرحباً',
      htmlBody: '<p>{{client_name}}</p>',
    });
    expect(result.id).toBe('tpl-1');
    expect(prisma.emailTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: 'welcome',
        subject: 'مرحباً',
        name: 'ترحيب',
        organizationId: 'org-A',
      }),
    });
  });

  it('throws ConflictException when slug already exists within this org', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({ id: 'tpl-existing' });
    const handler = new CreateEmailTemplateHandler(
      prisma as unknown as PrismaService,
      buildTenant('org-A') as never,
    );
    await expect(
      handler.execute({
        slug: 'welcome',
        name: 'ترحيب',
        subject: 'مرحباً',
        htmlBody: '<p></p>',
      }),
    ).rejects.toThrow('already exists');
    expect(prisma.emailTemplate.create).not.toHaveBeenCalled();
  });
});

// ─── UpdateEmailTemplateHandler ──────────────────────────────────────────────
describe('UpdateEmailTemplateHandler', () => {
  it('updates subject only when provided', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({
      id: 'tpl-1',
      slug: 'welcome',
    });
    prisma.emailTemplate.update.mockResolvedValueOnce({ id: 'tpl-1', subject: 'Updated' });
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      id: 'tpl-1',
      subject: 'Updated',
    });
    expect(result.subject).toBe('Updated');
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { subject: 'Updated' },
    });
  });

  it('throws NotFoundException when template missing', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ id: 'missing', subject: 'X' }),
    ).rejects.toThrow('not found');
  });

  it('throws NotFoundException when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ id: 'tpl-1', subject: 'X' }),
    ).rejects.toThrow('not found');
  });
});

// ─── GetEmailTemplateHandler ─────────────────────────────────────────────────
describe('GetEmailTemplateHandler', () => {
  it('returns template by id', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({
      id: 'tpl-1',
      slug: 'welcome',
    });
    const handler = new GetEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ id: 'tpl-1' });
    expect(result?.id).toBe('tpl-1');
  });

  it('returns null when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new GetEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ id: 'missing' });
    expect(result).toBeNull();
  });
});

// ─── PreviewEmailTemplateHandler ─────────────────────────────────────────────
describe('PreviewEmailTemplateHandler', () => {
  const mockTemplate = {
    id: 'tpl-1',
    subject: 'مرحباً {{client_name}}',
    htmlBody: '<p>Hi {{client_name}}</p>',
  };

  it('interpolates context into subject and body', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(mockTemplate);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      id: 'tpl-1',
      context: { client_name: 'أحمد' },
    });
    expect(result.subject).toBe('مرحباً أحمد');
    expect(result.body).toBe('<p>Hi أحمد</p>');
  });

  it('replaces missing context keys with empty string', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(mockTemplate);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      id: 'tpl-1',
      context: {},
    });
    expect(result.subject).toBe('مرحباً ');
    expect(result.body).toBe('<p>Hi </p>');
  });

  it('throws NotFoundException when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ id: 'missing', context: {} }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── ListEmailTemplatesHandler ───────────────────────────────────────────────
describe('ListEmailTemplatesHandler', () => {
  it('returns paginated templates', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findMany.mockResolvedValueOnce([{ id: 'tpl-1' }]);
    prisma.emailTemplate.count.mockResolvedValueOnce(1);
    const handler = new ListEmailTemplatesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.meta).toMatchObject({ total: 1, page: 1, totalPages: 1 });
    expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' }, skip: 0, take: 20 }),
    );
  });
});
