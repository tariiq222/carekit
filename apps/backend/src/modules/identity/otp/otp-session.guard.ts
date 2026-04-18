import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { OtpSessionService } from './otp-session.service';
import { PrismaService } from '../../../infrastructure/database';
import { OtpPurpose } from '@prisma/client';

@Injectable()
export class OtpSessionGuard implements CanActivate {
  constructor(
    private readonly otpSession: OtpSessionService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing OTP session token');
    }

    const token = authHeader.slice(7);
    const payload = this.otpSession.verifySession(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired OTP session');
    }

    if (payload.purpose !== OtpPurpose.GUEST_BOOKING) {
      throw new UnauthorizedException('OTP session purpose mismatch');
    }

    const used = await this.prisma.usedOtpSession.findUnique({
      where: { jti: payload.jti },
      select: { jti: true },
    });
    if (used) {
      throw new UnauthorizedException('OTP session already used');
    }

    (request as Request & { otpSession: typeof payload }).otpSession = payload;
    return true;
  }
}
