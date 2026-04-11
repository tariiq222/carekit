import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client | null = null;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  private configured: boolean;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    this.port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    this.useSSL = this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');

    if (!accessKey || !secretKey) {
      this.configured = false;
      this.logger.warn(
        'MinIO credentials not configured — file storage operations will be unavailable. ' +
          'Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY to enable file uploads.',
      );
      return;
    }

    this.configured = true;
    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });
  }

  /**
   * Returns whether MinIO is configured and available.
   * Use this to conditionally enable file upload features.
   */
  isAvailable(): boolean {
    return this.configured && this.client !== null;
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    this.assertAvailable();
    await this.ensureBucket(bucket);
    await this.client!.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    const protocol = this.useSSL ? 'https' : 'http';
    return `${protocol}://${this.endpoint}:${this.port}/${bucket}/${objectName}`;
  }

  async deleteFile(bucket: string, objectName: string): Promise<void> {
    this.assertAvailable();
    await this.client!.removeObject(bucket, objectName);
  }

  async ensureBucket(bucket: string): Promise<void> {
    this.assertAvailable();
    const exists = await this.client!.bucketExists(bucket);
    if (!exists) {
      await this.client!.makeBucket(bucket);
    }
  }

  private assertAvailable(): void {
    if (!this.configured || !this.client) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        message:
          'File storage (MinIO) is not configured. Set MINIO_ACCESS_KEY and MINIO_SECRET_KEY.',
        error: 'SERVICE_UNAVAILABLE',
      });
    }
  }
}
