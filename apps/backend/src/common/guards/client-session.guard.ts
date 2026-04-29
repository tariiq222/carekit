import { Injectable, ExecutionContext, UnauthorizedException, CanActivate } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../tenant/tenant.constants';
import { Request } from 'express';

/**
 * ClientSessionGuard accepts EITHER:
 *   1. The dedicated client JWT (namespace='client', signed with
 *      JWT_CLIENT_ACCESS_SECRET) — issued by /public/auth/login.
 *   2. The standard admin JWT (signed with JWT_ACCESS_SECRET) when the user
 *      has role=CLIENT and an associated Client record on the active org —
 *      this lets the mobile app's /mobile/auth/verify-otp flow access client
 *      portal endpoints without a second login round-trip.
 */
@Injectable()
export class ClientSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = this.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Invalid or expired client session');
    }

    // Client lookups bypass tenant scoping (we look up by userId/clientId
    // BEFORE tenant context is established). Use system context.
    const lookupClient = (where: Record<string, unknown>) =>
      this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.prisma.client.findFirst({ where });
      });

    // Try client JWT first.
    const clientSecret = this.config.get<string>('JWT_CLIENT_ACCESS_SECRET');
    if (clientSecret) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          namespace?: string;
          organizationId?: string;
        }>(token, { secret: clientSecret });
        if (payload.namespace === 'client') {
          const client = await lookupClient({ id: payload.sub });
          if (client?.isActive && !client.deletedAt) {
            req.user = {
              id: client.id,
              email: client.email,
              phone: client.phone,
              organizationId: payload.organizationId ?? client.organizationId ?? null,
            };
            return true;
          }
        }
      } catch {
        // fall through to admin JWT path
      }
    }

    // Fall back to admin JWT for users with role=CLIENT.
    const adminSecret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (adminSecret) {
      try {
        const payload = await this.jwt.verifyAsync<{
          sub: string;
          role?: string;
          organizationId?: string;
        }>(token, { secret: adminSecret });
        if (payload.role === 'CLIENT') {
          const client = await lookupClient({
            userId: payload.sub,
            isActive: true,
            deletedAt: null,
          });
          if (client) {
            req.user = {
              id: client.id,
              email: client.email,
              phone: client.phone,
              organizationId: payload.organizationId ?? client.organizationId,
            };
            return true;
          }
        }
      } catch {
        // fall through to throw
      }
    }

    throw new UnauthorizedException('Invalid or expired client session');
  }

  private extractToken(req: Request): string | null {
    const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies
      ?.client_access_token;
    if (cookieToken) return cookieToken;
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    return null;
  }
}
