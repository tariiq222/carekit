import {
  Controller, Get, Post, Delete, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsInt, IsOptional, Min } from 'class-validator';

interface MulterFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
import { Type } from 'class-transformer';
import { FileVisibility } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { UploadFileHandler } from '../../modules/media/files/upload-file.handler';
import { GetFileHandler } from '../../modules/media/files/get-file.handler';
import { DeleteFileHandler } from '../../modules/media/files/delete-file.handler';
import { GeneratePresignedUrlHandler } from '../../modules/media/files/generate-presigned-url.handler';

export class PresignedUrlQuery {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) expirySeconds?: number;
}

@Controller('dashboard/media')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardMediaController {
  constructor(
    private readonly uploadFile: UploadFileHandler,
    private readonly getFile: GetFileHandler,
    private readonly deleteFile: DeleteFileHandler,
    private readonly generatePresignedUrl: GeneratePresignedUrlHandler,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadFileEndpoint(
    @TenantId() tenantId: string,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.uploadFile.execute(
      {
        tenantId,
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        visibility: FileVisibility.PRIVATE,
      },
      file.buffer,
    );
  }

  @Get(':id')
  getFileEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getFile.execute(tenantId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFileEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteFile.execute(tenantId, id);
  }

  @Get(':id/presigned-url')
  presignedUrlEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PresignedUrlQuery,
  ) {
    return this.generatePresignedUrl.execute({
      tenantId,
      fileId: id,
      expirySeconds: query.expirySeconds,
    });
  }
}
