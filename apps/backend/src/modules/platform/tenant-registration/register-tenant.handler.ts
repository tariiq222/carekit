import { randomBytes } from 'crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from '../../identity/shared/password.service';
import { TokenService } from '../../identity/shared/token.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { SubscriptionCacheService } from '../billing/subscription-cache.service';
import { StartSubscriptionHandler } from '../billing/start-subscription/start-subscription.handler';
import type { RegisterTenantDto } from './register-tenant.dto';

function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .toLowerCase()
    .slice(0, 60);
}

function isPrismaUniqueOn(err: unknown, target: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; meta?: { target?: string | string[] } };
  if (e.code !== 'P2002') return false;
  const t = e.meta?.target;
  if (!t) return false;
  return Array.isArray(t) ? t.some((x) => x.includes(target)) : t.includes(target);
}

@Injectable()
export class RegisterTenantHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly tenant: TenantContextService,
    private readonly cache: SubscriptionCacheService,
    private readonly startSubscription: StartSubscriptionHandler,
  ) {}

  async execute(dto: RegisterTenantDto) {
    const planSlug = this.config.get<string>('PLATFORM_DEFAULT_PLAN_SLUG', 'BASIC');
    const plan = await this.prisma.plan.findFirst({ where: { slug: planSlug, isActive: true } });
    if (!plan) throw new NotFoundException(`Default plan '${planSlug}' not found — run the seed script`);

    const trialDays = this.config.get<number>('SAAS_TRIAL_DAYS', 14);
    const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000);
    const passwordHash = await this.password.hash(dto.password);
    const baseSlug = slugify(dto.businessNameAr) || 'org';

    // Generate a slug with a 6-hex random suffix to avoid races on the
    // unique constraint. We retry up to 3 times on slug-only collisions
    // before giving up. Email collisions surface as the proper 409.
    const maxAttempts = 3;
    let attempt = 0;
    let result: { orgId: string; userId: string; membershipId: string } | undefined;

    while (attempt < maxAttempts) {
      attempt += 1;
      const slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      try {
        result = await this.prisma.$transaction(async (tx) => {
          const org = await tx.organization.create({
            data: {
              slug,
              nameAr: dto.businessNameAr,
              nameEn: dto.businessNameEn ?? null,
              status: 'TRIALING',
              trialEndsAt,
            },
          });

          const user = await tx.user.create({
            data: {
              email: dto.email,
              name: dto.name,
              phone: dto.phone,
              passwordHash,
              role: 'ADMIN',
              isActive: true,
            },
          });

          const membership = await tx.membership.create({
            data: {
              userId: user.id,
              organizationId: org.id,
              role: 'OWNER',
              isActive: true,
              acceptedAt: new Date(),
            },
          });

          await tx.brandingConfig.create({
            data: {
              organizationId: org.id,
              organizationNameAr: dto.businessNameAr,
              organizationNameEn: dto.businessNameEn ?? null,
            },
          });

          await tx.organizationSettings.create({
            data: {
              organizationId: org.id,
              timezone: 'Asia/Riyadh',
              vatRate: 0.15,
            },
          });

          return { orgId: org.id, userId: user.id, membershipId: membership.id };
        });
        break;
      } catch (err: unknown) {
        if (isPrismaUniqueOn(err, 'email')) {
          throw new ConflictException('Email already registered');
        }
        if (isPrismaUniqueOn(err, 'slug') && attempt < maxAttempts) {
          continue;
        }
        throw err;
      }
    }

    if (!result) {
      throw new ConflictException('Could not allocate a unique organization slug — please retry');
    }

    // Set CLS tenant context so StartSubscriptionHandler.execute() can call requireOrganizationId()
    this.tenant.set({
      organizationId: result.orgId,
      membershipId: result.membershipId,
      id: result.userId,
      role: 'ADMIN',
      isSuperAdmin: false,
    });

    await this.startSubscription.execute({ planId: plan.id, billingCycle: 'MONTHLY' });

    this.cache.invalidate(result.orgId);

    const userForTokens = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    const tokenPair = await this.tokens.issueTokenPair(userForTokens, {
      organizationId: result.orgId,
      membershipId: result.membershipId,
      isSuperAdmin: false,
    });

    return { ...tokenPair, userId: result.userId };
  }
}
