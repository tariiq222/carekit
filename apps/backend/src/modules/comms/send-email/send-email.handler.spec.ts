import { SendEmailHandler } from './send-email.handler';
import type { SmtpService } from '../../../infrastructure/mail';
import type { PrismaService } from '../../../infrastructure/database';

const mockTemplate = {
  id: 'tpl-1',
  slug: 'welcome',
  subjectAr: 'مرحباً',
  htmlBody: '<p>{{client_name}}</p>',
  isActive: true,
};

const buildPrisma = () => ({
  emailTemplate: {
    findUnique: jest.fn().mockResolvedValue(mockTemplate),
  },
});

describe('SendEmailHandler', () => {
  it('substitutes template variables and sends email', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn().mockResolvedValue(undefined),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: { client_name: 'أحمد' },
    });
    expect(smtp.sendMail).toHaveBeenCalledWith(
      'client@example.com',
      'مرحباً',
      '<p>أحمد</p>',
    );
  });

  it('skips when SMTP unavailable', async () => {
    const prisma = buildPrisma();
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(false),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      to: 'client@example.com',
      templateSlug: 'welcome',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template not found', async () => {
    const prisma = buildPrisma();
    prisma.emailTemplate.findUnique.mockResolvedValue(null);
    const smtp = {
      isAvailable: jest.fn().mockReturnValue(true),
      sendMail: jest.fn(),
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({
      to: 'client@example.com',
      templateSlug: 'missing',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});

describe('SendEmailHandler — interpolation', () => {
  it('skips email when SMTP not available', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(false), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn() } };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({ to: 'a@b.com', templateSlug: 'booking-confirmed', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template not found', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn().mockResolvedValue(null) } };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({ to: 'a@b.com', templateSlug: 'missing', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('skips when template is inactive', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn() };
    const prisma = { emailTemplate: { findUnique: jest.fn().mockResolvedValue({ isActive: false, htmlBody: '', subjectAr: '' }) } };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: {} });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });

  it('replaces {{vars}} in htmlBody and subject', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      emailTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          htmlBody: '<p>Hello {{name}}</p>',
          subjectAr: 'مرحبا {{name}}',
          subjectEn: 'Hello {{name}}',
        }),
      },
    };
    await new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: { name: 'Ahmad' } });
    expect(smtp.sendMail).toHaveBeenCalledWith('a@b.com', 'مرحبا Ahmad', '<p>Hello Ahmad</p>');
  });

  it('does not throw when smtp.sendMail rejects', async () => {
    const smtp = { isAvailable: jest.fn().mockReturnValue(true), sendMail: jest.fn().mockRejectedValue(new Error('SMTP down')) };
    const prisma = {
      emailTemplate: { findUnique: jest.fn().mockResolvedValue({ isActive: true, htmlBody: 'body', subjectAr: 'subj', subjectEn: '' }) },
    };
    await expect(new SendEmailHandler(smtp as unknown as SmtpService, prisma as unknown as PrismaService).execute({ to: 'a@b.com', templateSlug: 'tpl', vars: {} })).resolves.not.toThrow();
  });
});
