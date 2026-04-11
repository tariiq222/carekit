import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import * as Minio from 'minio';

@Injectable()
export class MinioHealthIndicator {
  private readonly client: Minio.Client;
  private readonly logger = new Logger(MinioHealthIndicator.name);

  constructor(
    private readonly indicator: HealthIndicatorService,
    private readonly config: ConfigService,
  ) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    const port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    const useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY', '');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY', '');

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async check() {
    const session = this.indicator.check('minio');

    try {
      await this.client.listBuckets();
      return session.up();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`MinIO health check failed: ${message}`);
      return session.down({ message });
    }
  }
}
