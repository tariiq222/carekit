import {
  Controller, Get, Post, Delete, Param, Query, Body,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { UploadFileHandler } from '../../modules/media/files/upload-file.handler';
import { UploadFileDto } from '../../modules/media/files/upload-file.dto';
import { GetFileHandler } from '../../modules/media/files/get-file.handler';
import { DeleteFileHandler } from '../../modules/media/files/delete-file.handler';
import { GeneratePresignedUrlHandler } from '../../modules/media/files/generate-presigned-url.handler';
import { GeneratePresignedUrlDto } from '../../modules/media/files/generate-presigned-url.dto';

@ApiTags('Media')
@ApiBearerAuth()
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
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadFileDto,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    return this.uploadFile.execute(
      {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        ...body,
      },
      file.buffer,
    );
  }

  @Get(':id')
  getFileEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getFile.execute(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFileEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteFile.execute(id);
  }

  @Get(':id/presigned-url')
  presignedUrlEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GeneratePresignedUrlDto,
  ) {
    return this.generatePresignedUrl.execute({
      fileId: id,
      ...query,
    });
  }
}
