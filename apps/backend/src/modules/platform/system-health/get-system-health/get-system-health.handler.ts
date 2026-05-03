import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface SubsystemHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  detail?: string;
}

export interface SystemHealthResult {
  overall: 'ok' | 'degraded' | 'down';
  subsystems: SubsystemHealth[];
  checkedAt: string;
}

@Injectable()
export class GetSystemHealthHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<SystemHealthResult> {
    const subsystems: SubsystemHealth[] = [];

    // Postgres
    const pgStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      subsystems.push({ name: 'postgres', status: 'ok', latencyMs: Date.now() - pgStart });
    } catch (err) {
      subsystems.push({ name: 'postgres', status: 'down', latencyMs: Date.now() - pgStart, detail: String(err) });
    }

    // Redis — try to detect via env
    const redisUrl = process.env.REDIS_URL ?? process.env.REDIS_HOST;
    if (redisUrl) {
      subsystems.push({ name: 'redis', status: 'ok', latencyMs: 0, detail: 'env configured' });
    } else {
      subsystems.push({ name: 'redis', status: 'degraded', latencyMs: 0, detail: 'REDIS_URL not set' });
    }

    // MinIO
    const minioEndpoint = process.env.MINIO_ENDPOINT;
    if (minioEndpoint) {
      subsystems.push({ name: 'minio', status: 'ok', latencyMs: 0, detail: 'env configured' });
    } else {
      subsystems.push({ name: 'minio', status: 'degraded', latencyMs: 0, detail: 'MINIO_ENDPOINT not set' });
    }

    const downCount = subsystems.filter((s) => s.status === 'down').length;
    const degradedCount = subsystems.filter((s) => s.status === 'degraded').length;
    const overall = downCount > 0 ? 'down' : degradedCount > 0 ? 'degraded' : 'ok';

    return { overall, subsystems, checkedAt: new Date().toISOString() };
  }
}
