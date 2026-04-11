import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database';
import { UploadFileHandler } from './files/upload-file.handler';
import { GetFileHandler } from './files/get-file.handler';
import { DeleteFileHandler } from './files/delete-file.handler';
import { GeneratePresignedUrlHandler } from './files/generate-presigned-url.handler';

const handlers = [
  UploadFileHandler,
  GetFileHandler,
  DeleteFileHandler,
  GeneratePresignedUrlHandler,
];

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [...handlers],
  exports: [...handlers],
})
export class MediaModule {}
