import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InviteMemberHandler } from './invite-member.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { SmtpService } from '../../../infrastructure/mail/smtp.service';

describe('InviteMemberHandler', () => {
  let handler: InviteMemberHandler;
  let prisma: PrismaService;
  let smtpService: SmtpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteMemberHandler,
        {
          provide: PrismaService,
          useValue: {
            user: { findUnique: jest.fn().mockResolvedValue(null) },
            membership: { findFirst: jest.fn().mockResolvedValue(null) },
            invitation: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            requireOrganizationId: jest.fn().mockReturnValue('org-123'),
            get: jest.fn().mockReturnValue({ id: 'user-1' }),
          },
        },
        {
          provide: SmtpService,
          useValue: {
            sendMail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3000'),
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    handler = module.get<InviteMemberHandler>(InviteMemberHandler);
    prisma = module.get<PrismaService>(PrismaService);
    smtpService = module.get<SmtpService>(SmtpService);
  });

  it('should create invitation and send email', async () => {
    const result = await handler.execute({ email: 'new@example.com', role: 'RECEPTIONIST' });

    expect(result.invitationId).toBe('inv-1');
    expect(prisma.invitation.create).toHaveBeenCalled();
    expect(smtpService.sendMail).toHaveBeenCalled();
  });

  it('should throw ALREADY_MEMBER when user is already a member', async () => {
    prisma.membership.findFirst = jest.fn().mockResolvedValue({ id: 'm1' });

    await expect(handler.execute({ email: 'existing@example.com', role: 'ADMIN' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('should revoke prior pending invitations for same email', async () => {
    await handler.execute({ email: 'new@example.com', role: 'ADMIN' });

    expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-123', email: 'new@example.com', status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) },
    });
  });
});