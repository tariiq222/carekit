import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { SmtpService } from '../../../infrastructure/mail/smtp.service';
import { MembershipRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

export interface InviteMemberDto {
  email: string;
  role: MembershipRole;
}

const INVITE_TTL_HOURS = 72;

@Injectable()
export class InviteMemberHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly smtpService: SmtpService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: InviteMemberDto): Promise<{ invitationId: string }> {
    const organizationId = this.tenant.requireOrganizationId();
    const userId = this.tenant.get()?.id;
    if (!userId) throw new UnauthorizedException();
    const dashboardUrl = this.config.get<string>('DASHBOARD_URL') ?? 'http://localhost:3000';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      const existingMembership = await this.prisma.membership.findFirst({
        where: { organizationId, userId: user.id },
      });
      if (existingMembership) {
        throw new ConflictException('ALREADY_MEMBER');
      }
    }

    await this.prisma.invitation.updateMany({
      where: { organizationId, email: dto.email, status: 'PENDING' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    const inviteSecret = this.config.getOrThrow<string>('INVITE_SECRET');
    const token = jwt.sign(
      { organizationId, email: dto.email, role: dto.role },
      inviteSecret,
      { expiresIn: `${INVITE_TTL_HOURS}h` },
    );

    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
        invitedByUserId: userId,
      },
    });

    const acceptUrl = `${dashboardUrl}/accept-invitation?token=${token}`;
    const subject = 'You have been invited to join a clinic';
    const html = `<p>You have been invited to join a clinic as ${dto.role}. Click <a href="${acceptUrl}">here</a> to accept the invitation.</p>`;

    await this.smtpService.sendMail(dto.email, subject, html);

    return { invitationId: invitation.id };
  }
}