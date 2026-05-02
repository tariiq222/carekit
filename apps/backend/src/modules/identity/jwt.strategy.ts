import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import type { JwtPayload } from './shared/token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly casl: CaslAbilityFactory,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    const ability = this.casl.buildForUser(user);

    return {
      // Both `id` and `sub` carry the same User.id. The codebase has historic
      // splits — tenant middleware + half the controllers read `user.id`,
      // while admin/impersonation + mobile/employee controllers read
      // `user.sub`. Exposing both keeps every audit-trail call site correct
      // until the codebase is unified on `id` (separate cleanup ticket).
      id: user.id,
      sub: user.id,
      email: user.email,
      role: user.role,
      membershipRole: payload.membershipRole, // phase-A: now available on req.user
      customRoleId: user.customRoleId,
      permissions: ability.rules.flatMap((r) => {
        const actions = Array.isArray(r.action) ? r.action : [r.action];
        return actions.map((a) => ({ action: String(a), subject: String(r.subject) }));
      }),
      features: payload.features ?? [],
      // SaaS-01 — tenant claims passed through from JWT. Undefined in off/legacy tokens.
      organizationId: payload.organizationId,
      membershipId: payload.membershipId,
      isSuperAdmin: payload.isSuperAdmin === true || (user.isSuperAdmin ?? false),
      scope: payload.scope,
      impersonationSessionId: payload.impersonationSessionId,
    };
  }
}
