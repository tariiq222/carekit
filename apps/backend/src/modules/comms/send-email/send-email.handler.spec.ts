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
      tenantId: 'tenant-1',
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
      tenantId: 'tenant-1',
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
      tenantId: 'tenant-1',
      to: 'client@example.com',
      templateSlug: 'missing',
      vars: {},
    });
    expect(smtp.sendMail).not.toHaveBeenCalled();
  });
});
