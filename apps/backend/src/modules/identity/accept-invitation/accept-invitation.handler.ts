import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database';
import { TokenService } from '../shared/token.service';
import { MembershipRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';

export interface AcceptInvitationDto {
  token: string;
  password?: string;
}

interface InvitationPayload {
  organizationId: string;
  email: string;
  role: string;
}

@Injectable()
export class AcceptInvitationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
  ) {}

  async execute(dto: AcceptInvitationDto): Promise<{ accessToken: string; refreshToken: string }> {
    const inviteSecret = this.config.getOrThrow<string>('INVITE_SECRET');

    let payload: InvitationPayload;
    try {
      payload = jwt.verify(dto.token, inviteSecret) as InvitationPayload;
    } catch {
      throw new UnauthorizedException('INVALID_TOKEN');
    }

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        token: dto.token,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new BadRequestException('INVITATION_NOT_FOUND_OR_EXPIRED');
    }

    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      if (!dto.password) {
        throw new BadRequestException('PASSWORD_REQUIRED_FOR_NEW_USER');
      }
      const passwordHash = await bcrypt.hash(dto.password, 10);
      user = await this.prisma.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          name: invitation.email.split('@')[0],
        },
      });
    }

    const existingMembership = await this.prisma.membership.findFirst({
      where: { userId: user.id, organizationId: invitation.organizationId },
    });

    if (existingMembership) {
      throw new ConflictException('ALREADY_MEMBER');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          userId: user!.id,
          organizationId: invitation.organizationId,
          role: invitation.role as MembershipRole,
          isActive: true,
          acceptedAt: new Date(),
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
    });

    const userForToken = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { customRole: { include: { permissions: true } } },
    });

    const { accessToken, refreshToken } = await this.tokenService.issueTokenPair(
      {
        id: userForToken.id,
        email: userForToken.email,
        role: userForToken.role,
        customRoleId: userForToken.customRoleId,
        customRole: userForToken.customRole,
      },
      { organizationId: invitation.organizationId },
    );

    return { accessToken, refreshToken };
  }
}