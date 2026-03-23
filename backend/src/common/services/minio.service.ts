import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private client: Minio.Client;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;

  constructor(private config: ConfigService) {
    this.endpoint = this.config.get<string>('MINIO_ENDPOINT', 'localhost');
    this.port = parseInt(this.config.get<string>('MINIO_PORT', '9000'), 10);
    this.useSSL =
      this.config.get<string>('MINIO_USE_SSL', 'false') === 'true';

    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY');

    if (!accessKey || !secretKey) {
      throw new Error(
        'MINIO_ACCESS_KEY and MINIO_SECRET_KEY environment variables are required',
      );
    }

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });
  }

  async uploadFile(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.ensureBucket(bucket);
    await this.client.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    const protocol = this.useSSL ? 'https' : 'http';
    return `${protocol}://${this.endpoint}:${this.port}/${bucket}/${objectName}`;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }
}
