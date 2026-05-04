import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { SUPER_ADMIN_CONTEXT_CLS_KEY } from '../../../common/tenant/tenant.constants';
import { PlatformMailerService } from '../../../infrastructure/mail/platform-mailer.service';
import type { InviteUserCommand, InviteUserResult } from './invite-user.command';

const INVITE_TTL_DAYS = 7;

/**
 * Privacy-safe invite:
 *
 *  - We NEVER reveal whether `email` already corresponds to an existing User.
 *    The inviter sees the same response either way.
 *  - We DO reject inviting an email that already has an ACTIVE membership in
 *    the same organization (that is org-internal information already known
 *    to the inviter via the employees list).
 *  - On accept, the invitation is linked to the existing User if any, or a
 *    new User is created. Both branches happen inside accept-invitation,
 *    not here.
 */
@Injectable()
export class InviteUserHandler {
  private readonly logger = new Logger(InviteUserHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: PlatformMailerService,
    private readonly config: ConfigService,
    private readonly cls: ClsService,
  ) {}

  async execute(cmd: InviteUserCommand): Promise<InviteUserResult> {
    const email = cmd.email.trim().toLowerCase();

    // Reject only if an active membership already exists (org-internal fact).
    // Wrap in super-admin CLS context so $allTenants does not throw.
    const existingMembership = await this.cls.run(async () => {
      this.cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true);
      return this.prisma.$allTenants.membership.findFirst({
        where: {
          organizationId: cmd.organizationId,
          isActive: true,
          user: { email },
        },
        select: { id: true },
      });
    });
    if (existingMembership) {
      throw new ConflictException('User is already an active member of this organization');
    }

    // Revoke any earlier still-PENDING invitation for the same email/org so
    // only one valid token exists at a time. Privacy-neutral: same outcome
    // regardless of recipient existence.
    await this.prisma.invitation.updateMany({
      where: {
        organizationId: cmd.organizationId,
        email,
        status: 'PENDING',
      },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: cmd.organizationId,
        email,
        role: cmd.role,
        token,
        status: 'PENDING',
        expiresAt,
        invitedByUserId: cmd.invitedByUserId,
        displayName: cmd.displayName ?? null,
        jobTitle: cmd.jobTitle ?? null,
      },
      select: { id: true, organization: { select: { nameAr: true, nameEn: true } } },
    });

    const dashboardUrl = this.config.get<string>(
      'PLATFORM_DASHBOARD_URL',
      'https://app.webvue.pro/dashboard',
    );
    const acceptUrl = `${dashboardUrl.replace(/\/+$/, '')}/accept-invitation?token=${token}`;
    const recipientName = cmd.displayName?.trim() || email.split('@')[0]!;

    try {
      await this.mailer.sendMembershipInvitation(email, {
        recipientName,
        orgNameAr: invitation.organization.nameAr,
        orgNameEn: invitation.organization.nameEn ?? undefined,
        acceptUrl,
        expiresIn: `${INVITE_TTL_DAYS} days`,
      });
    } catch (err) {
      // Email delivery is best-effort. The invitation row exists; the inviter
      // can re-send. Do not surface a different error path to avoid leaking
      // recipient existence.
      this.logger.warn(
        `Invitation email dispatch failed for ${email}: ${(err as Error).message}`,
      );
    }

    return {
      invitationId: invitation.id,
      status: 'PENDING',
      expiresAt,
    };
  }
}
