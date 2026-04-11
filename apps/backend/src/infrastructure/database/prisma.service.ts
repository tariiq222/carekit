import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Single PrismaClient instance shared across all Bounded Contexts.
 *
 * Even though each BC owns its own schema file, they all compile to one
 * generated client — one connection pool for the whole backend. BCs must
 * still respect context boundaries at the application layer: no BC should
 * query another BC's tables directly; cross-context reads go through
 * domain events or explicit read-model projections.
 *
 * Prisma 7 requires a driver adapter. We use `@prisma/adapter-pg`, which
 * wraps `node-postgres` and reads the connection string from
 * `process.env.DATABASE_URL`. The URL is validated at boot by
 * `envValidationSchema`, so it is guaranteed to be present here.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
