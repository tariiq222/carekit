import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { TenantContextService, TenantContext } from '../../src/common/tenant';

export interface IsolationHarness {
  app: INestApplication;
  prisma: PrismaService;
  cls: ClsService;
  ctx: TenantContextService;
  createOrg: (slug: string, nameAr: string) => Promise<{ id: string }>;
  runAs: <T>(context: Partial<TenantContext>, fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

/**
 * Boots a real AppModule against the dev/test database. Intended for
 * cross-tenant isolation proofs — NOT for fast unit tests.
 */
export async function bootHarness(): Promise<IsolationHarness> {
  const mod: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = mod.createNestApplication();
  await app.init();

  const prisma = app.get(PrismaService);
  const cls = app.get(ClsService);
  const ctx = app.get(TenantContextService);

  const createOrg = async (slug: string, nameAr: string) => {
    const row = await prisma.organization.upsert({
      where: { slug },
      update: {},
      create: { slug, nameAr, status: 'ACTIVE' },
      select: { id: true },
    });
    return row;
  };

  const runAs = <T>(partial: Partial<TenantContext>, fn: () => Promise<T>): Promise<T> =>
    cls.run(() => {
      ctx.set({
        organizationId: partial.organizationId ?? '',
        membershipId: partial.membershipId ?? '',
        id: partial.id ?? '',
        role: partial.role ?? 'ADMIN',
        isSuperAdmin: partial.isSuperAdmin === true,
      });
      return fn();
    });

  return {
    app,
    prisma,
    cls,
    ctx,
    createOrg,
    runAs,
    close: async () => {
      await app.close();
    },
  };
}
