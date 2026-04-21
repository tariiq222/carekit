import { Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  buildTenantScopingExtension,
  TenantScopedModelRegistry,
} from '../../common/tenant/tenant-scoping.extension';
import { TenantEnforcementMode } from '../../common/tenant/tenant.constants';

/**
 * Plan 02 populates this set cluster-by-cluster. Empty here is intentional —
 * every model is treated as un-scoped, matching current single-tenant behavior.
 */
const SCOPED_MODELS: TenantScopedModelRegistry = new Set<string>();

/**
 * Single PrismaClient instance shared across all Bounded Contexts.
 *
 * Why a Proxy instead of `Object.assign(this, extended)`?
 * - In Prisma 7, `$extends` returns a different runtime client whose model
 *   accessors use internal proxy traps. Copying those traps onto `this` with
 *   Object.assign silently drops fields and produces subtle bugs at query time.
 * - A Proxy preserves the full extended client (including its traps) while
 *   keeping `PrismaService` a `PrismaClient` subclass for DI and types.
 * - Callers that read `prisma.user.findMany(...)` transparently hit the
 *   extended client's hooks, which is exactly what we want.
 *
 * With `SCOPED_MODELS` empty in Plan 01 the hook is a per-query `Set.has()`
 * lookup that returns false and short-circuits — no behavior change.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly extended: PrismaClient;

  constructor(
    // `@Optional()` lets isolated test modules instantiate PrismaService
    // without wiring ConfigModule/TenantModule. In prod both are global and
    // always present — the optionals are only for narrow unit-test fixtures.
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly tenantCtx?: TenantContextService,
  ) {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    const mode = (this.config?.get<TenantEnforcementMode>('TENANT_ENFORCEMENT', 'off') ??
      'off') as TenantEnforcementMode;

    // When DI is not available (unit tests using `new PrismaService()`), fall
    // back to the base client unchanged — the extension would have nothing to
    // scope anyway because there is no tenant context. Prod always has DI.
    if (mode === 'off' || !this.tenantCtx) {
      this.extended = this as unknown as PrismaClient;
      return;
    }

    // `$extends`'s input type is generated from the user's schema and does not
    // cleanly accept a statically-typed factory extension; cast through unknown.
    const ext = buildTenantScopingExtension(this.tenantCtx, mode, SCOPED_MODELS);
    this.extended = this.$extends(ext as unknown as Parameters<typeof this.$extends>[0]) as unknown as PrismaClient;

    // Proxy reads for model accessors and $-methods go to the extended client;
    // lifecycle + internal fields stay on the base class.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop === 'onModuleInit' ||
          prop === 'onModuleDestroy' ||
          prop === 'logger' ||
          prop === 'config' ||
          prop === 'tenantCtx' ||
          prop === 'extended' ||
          prop === '$connect' ||
          prop === '$disconnect'
        ) {
          return Reflect.get(target, prop, receiver);
        }
        const fromExtended = Reflect.get(self.extended as object, prop);
        if (typeof fromExtended === 'function') {
          return (fromExtended as (...args: unknown[]) => unknown).bind(self.extended);
        }
        return fromExtended ?? Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(
      `Prisma connected (tenant mode = ${this.config?.get('TENANT_ENFORCEMENT', 'off') ?? 'off'})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
