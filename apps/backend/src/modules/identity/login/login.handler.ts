import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';
import { PasswordService } from '../shared/password.service';
import { TokenService, TokenPair } from '../shared/token.service';
import type { LoginCommand } from './login.command';

@Injectable()
export class LoginHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  async execute(cmd: LoginCommand): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: cmd.email },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    // passwordHash became nullable when mobile OTP-only auth landed — staff
    // accounts always have one, but defensive null check guards against any
    // mobile-first / passwordless user being routed to the dashboard login.
    if (!user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.password.verify(cmd.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // SaaS-01 — resolve active membership and forward as tenant claims.
    // Fallback to DEFAULT_ORGANIZATION_ID keeps legacy users (no backfilled
    // membership) able to log in without crashing.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, organizationId: true, role: true },
    });

    return this.tokens.issueTokenPair(user, {
      organizationId: membership?.organizationId ?? DEFAULT_ORGANIZATION_ID,
      membershipId: membership?.id,
      membershipRole: membership?.role ?? undefined,
      isSuperAdmin: user.isSuperAdmin ?? false,
    });
  }
}
