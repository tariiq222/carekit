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
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
      customRoleId: user.customRoleId,
      permissions: ability.rules.flatMap((r) => {
        const actions = Array.isArray(r.action) ? r.action : [r.action];
        return actions.map((a) => ({ action: String(a), subject: String(r.subject) }));
      }),
      features: payload.features ?? [],
    };
  }
}
