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

// ─── CreateEmailTemplateHandler ──────────────────────────────────────────────
describe('CreateEmailTemplateHandler', () => {
  it('creates an email template when slug is free', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findUnique.mockResolvedValueOnce(null);
    prisma.emailTemplate.create.mockResolvedValueOnce({ id: 'tpl-1', slug: 'welcome' });
    const handler = new CreateEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      slug: 'welcome',
      nameAr: 'ترحيب',
      subjectAr: 'مرحباً',
      htmlBody: '<p>{{client_name}}</p>',
    });
    expect(result.id).toBe('tpl-1');
    expect(prisma.emailTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        slug: 'welcome',
        subjectAr: 'مرحباً',
      }),
    });
  });

  it('throws ConflictException when slug already exists for tenant', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-existing' });
    const handler = new CreateEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({
        tenantId: 'tenant-1',
        slug: 'welcome',
        nameAr: 'ترحيب',
        subjectAr: 'مرحباً',
        htmlBody: '<p></p>',
      }),
    ).rejects.toThrow('already exists');
    expect(prisma.emailTemplate.create).not.toHaveBeenCalled();
  });
});

// ─── UpdateEmailTemplateHandler ──────────────────────────────────────────────
describe('UpdateEmailTemplateHandler', () => {
  it('updates subjectAr only when provided', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({
      id: 'tpl-1',
      tenantId: 'tenant-1',
      slug: 'welcome',
    });
    prisma.emailTemplate.update.mockResolvedValueOnce({ id: 'tpl-1', subjectAr: 'Updated' });
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      id: 'tpl-1',
      subjectAr: 'Updated',
    });
    expect(result.subjectAr).toBe('Updated');
    expect(prisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      data: { subjectAr: 'Updated' },
    });
  });

  it('throws NotFoundException when template missing', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ tenantId: 'tenant-1', id: 'missing', subjectAr: 'X' }),
    ).rejects.toThrow('not found');
  });

  it('throws NotFoundException when template belongs to another tenant', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new UpdateEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ tenantId: 'tenant-1', id: 'tpl-1', subjectAr: 'X' }),
    ).rejects.toThrow('not found');
  });
});

// ─── GetEmailTemplateHandler ─────────────────────────────────────────────────
describe('GetEmailTemplateHandler', () => {
  it('returns template by id when tenant matches', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce({
      id: 'tpl-1',
      tenantId: 'tenant-1',
      slug: 'welcome',
    });
    const handler = new GetEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', id: 'tpl-1' });
    expect(result?.id).toBe('tpl-1');
  });

  it('returns null when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new GetEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', id: 'missing' });
    expect(result).toBeNull();
  });

  it('returns null when template belongs to another tenant', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new GetEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', id: 'tpl-1' });
    expect(result).toBeNull();
  });
});

// ─── PreviewEmailTemplateHandler ─────────────────────────────────────────────
describe('PreviewEmailTemplateHandler', () => {
  const mockTemplate = {
    id: 'tpl-1',
    tenantId: 'tenant-1',
    subjectAr: 'مرحباً {{client_name}}',
    subjectEn: 'Hello {{client_name}}',
    bodyAr: '<p>مرحباً {{client_name}}</p>',
    bodyEn: '<p>Hello {{client_name}}</p>',
  };

  it('interpolates context into subject and body for Arabic', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(mockTemplate);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      id: 'tpl-1',
      lang: 'ar',
      context: { client_name: 'أحمد' },
    });
    expect(result.subject).toBe('مرحباً أحمد');
    expect(result.body).toBe('<p>مرحباً أحمد</p>');
  });

  it('interpolates context into subject and body for English', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(mockTemplate);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      id: 'tpl-1',
      lang: 'en',
      context: { client_name: 'John' },
    });
    expect(result.subject).toBe('Hello John');
    expect(result.body).toBe('<p>Hello John</p>');
  });

  it('replaces missing context keys with empty string', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(mockTemplate);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({
      tenantId: 'tenant-1',
      id: 'tpl-1',
      lang: 'en',
      context: {},
    });
    expect(result.subject).toBe('Hello ');
    expect(result.body).toBe('<p>Hello </p>');
  });

  it('throws NotFoundException when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findFirst.mockResolvedValueOnce(null);
    const handler = new PreviewEmailTemplateHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ tenantId: 'tenant-1', id: 'missing', lang: 'ar', context: {} }),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── ListEmailTemplatesHandler ───────────────────────────────────────────────
describe('ListEmailTemplatesHandler', () => {
  it('returns paginated templates scoped to tenant', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findMany.mockResolvedValueOnce([{ id: 'tpl-1' }]);
    prisma.emailTemplate.count.mockResolvedValueOnce(1);
    const handler = new ListEmailTemplatesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ tenantId: 'tenant-1', page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    expect(prisma.emailTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      orderBy: { createdAt: 'asc' },
      skip: 0,
      take: 20,
    });
  });
});
