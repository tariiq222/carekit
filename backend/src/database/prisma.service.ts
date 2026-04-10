import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const SLOW_QUERY_THRESHOLD_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const adapter = new PrismaPg({ connectionString });
    super({
      adapter,
      log: [
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
        { level: 'query', emit: 'event' },
      ],
    });

    // Log Prisma errors and warnings
    (
      this.$on as (
        event: Prisma.LogLevel,
        cb: (e: Prisma.QueryEvent | Prisma.LogEvent) => void,
      ) => void
    )('error', (e) =>
      this.logger.error(`Prisma error: ${(e as Prisma.LogEvent).message}`),
    );
    (
      this.$on as (
        event: Prisma.LogLevel,
        cb: (e: Prisma.QueryEvent | Prisma.LogEvent) => void,
      ) => void
    )('warn', (e) =>
      this.logger.warn(`Prisma warning: ${(e as Prisma.LogEvent).message}`),
    );

    // Slow query detection
    (this.$on as (event: 'query', cb: (e: Prisma.QueryEvent) => void) => void)(
      'query',
      (e) => {
        if (e.duration >= SLOW_QUERY_THRESHOLD_MS) {
          this.logger.warn(
            `Slow query detected (${e.duration}ms): ${e.query.slice(0, 200)}`,
          );
        }
      },
    );
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
