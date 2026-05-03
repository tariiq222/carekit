import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';
import { PasswordService } from '../shared/password.service';
import { TokenService, TokenPair } from '../shared/token.service';
import type { LoginCommand } from './login.command';

const LOCKOUT_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;

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

    // Per-account lockout — check before password verify to avoid bcrypt cost
    // on a locked account and to not leak timing information.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account locked. Try again later.');
    }

    const valid = await this.password.verify(cmd.password, user.passwordHash);

    if (!valid) {
      const newCount = user.failedLoginAttempts + 1;
      const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : newCount,
          ...(shouldLock
            ? { lockedUntil: new Date(Date.now() + LOCKOUT_WINDOW_MINUTES * 60 * 1000) }
            : {}),
        },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset lockout counters on successful login.
    if (user.failedLoginAttempts > 0 || user.lockedUntil !== null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // SaaS-01 — resolve active membership and forward as tenant claims.
    // Sticky-org: prefer User.lastActiveOrganizationId when it still maps
    // to an active membership, so multi-org users land on their last
    // chosen tenant. Otherwise fall back to canonical ordering. Final
    // fallback to DEFAULT_ORGANIZATION_ID keeps legacy users (no
    // backfilled membership) able to log in without crashing.
    const activeMemberships = await this.prisma.membership.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, organizationId: true, role: true },
    });
    const sticky = user.lastActiveOrganizationId
      ? activeMemberships.find(
          (m) => m.organizationId === user.lastActiveOrganizationId,
        ) ?? null
      : null;
    const membership = sticky ?? activeMemberships[0] ?? null;

    return this.tokens.issueTokenPair(user, {
      organizationId: membership?.organizationId ?? DEFAULT_ORGANIZATION_ID,
      membershipId: membership?.id,
      membershipRole: membership?.role ?? undefined,
      isSuperAdmin: user.isSuperAdmin ?? false,
    });
  }
}
