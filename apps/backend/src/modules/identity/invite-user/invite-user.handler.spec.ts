import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { InviteUserHandler } from './invite-user.handler';
import { PrismaService } from '../../../infrastructure/database';
import { PlatformMailerService } from '../../../infrastructure/mail/platform-mailer.service';

describe('InviteUserHandler', () => {
  let handler: InviteUserHandler;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let mailer: jest.Mocked<PlatformMailerService>;
  let cls: { run: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    cls = {
      run: jest.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
      set: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        InviteUserHandler,
        {
          provide: PrismaService,
          useValue: {
            $allTenants: {
              membership: { findFirst: jest.fn().mockResolvedValue(null) },
            },
            invitation: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue({
                id: 'inv-1',
                organization: { nameAr: 'النور', nameEn: 'AlNoor' },
              }),
            },
          } as unknown as PrismaService,
        },
        {
          provide: PlatformMailerService,
          useValue: {
            sendMembershipInvitation: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://app.example.com/dashboard') },
        },
        {
          provide: ClsService,
          useValue: cls,
        },
      ],
    }).compile();

    handler = module.get(InviteUserHandler);
    prisma = module.get(PrismaService);
    mailer = module.get(PlatformMailerService);
  });

  it('creates a PENDING invitation and dispatches an email', async () => {
    const result = await handler.execute({
      invitedByUserId: 'admin-1',
      organizationId: 'org-1',
      email: 'Ahmad@Clinic.SA',
      role: 'RECEPTIONIST',
      displayName: 'د. أحمد',
      jobTitle: 'استشاري',
    });

    expect(result.status).toBe('PENDING');
    expect(result.invitationId).toBe('inv-1');
    expect(prisma.invitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'ahmad@clinic.sa',
          organizationId: 'org-1',
          displayName: 'د. أحمد',
          jobTitle: 'استشاري',
          status: 'PENDING',
          invitedByUserId: 'admin-1',
        }),
      }),
    );
    expect(mailer.sendMembershipInvitation).toHaveBeenCalledWith(
      'ahmad@clinic.sa',
      expect.objectContaining({ orgNameAr: 'النور', recipientName: 'د. أحمد' }),
    );
  });

  it('rejects when email already has an active membership in the org', async () => {
    prisma.$allTenants.membership.findFirst.mockResolvedValueOnce({ id: 'm-1' });
    await expect(
      handler.execute({
        invitedByUserId: 'admin-1',
        organizationId: 'org-1',
        email: 'taken@clinic.sa',
        role: 'RECEPTIONIST',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.invitation.create).not.toHaveBeenCalled();
  });

  it('revokes earlier PENDING invitations for the same email/org', async () => {
    await handler.execute({
      invitedByUserId: 'admin-1',
      organizationId: 'org-1',
      email: 'someone@clinic.sa',
      role: 'RECEPTIONIST',
    });
    expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', email: 'someone@clinic.sa', status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: expect.any(Date) },
    });
  });

  it('does not surface a different error when mail dispatch fails (privacy)', async () => {
    mailer.sendMembershipInvitation.mockRejectedValueOnce(new Error('SMTP boom'));
    const result = await handler.execute({
      invitedByUserId: 'admin-1',
      organizationId: 'org-1',
      email: 'fail@clinic.sa',
      role: 'RECEPTIONIST',
    });
    expect(result.status).toBe('PENDING');
  });

  it('wraps $allTenants membership lookup in super-admin CLS context', async () => {
    await handler.execute({
      invitedByUserId: 'admin-1',
      organizationId: 'org-1',
      email: 'newuser@clinic.sa',
      role: 'RECEPTIONIST',
    });

    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
  });
});
