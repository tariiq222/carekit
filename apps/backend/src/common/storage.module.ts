import { Global, Module } from '@nestjs/common';
import { MinioService } from './services/minio.service.js';

@Global()
@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class StorageModule {}
