import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ChatbotRagService } from './chatbot-rag.service.js';
import { ChatbotFileService } from './chatbot-file.service.js';
import { CreateKbEntryDto, UpdateKbEntryDto } from './dto/kb-entry.dto.js';
import { MAX_KB_FILE_SIZE } from '../../config/constants.js';
import { validateFileContent } from '../../common/helpers/file-validation.helper.js';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('chatbot')
export class ChatbotKbController {
  constructor(
    private readonly ragService: ChatbotRagService,
    private readonly fileService: ChatbotFileService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  KNOWLEDGE BASE — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('knowledge-base')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  @ApiOperation({ summary: 'List knowledge base entries' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'source', required: false, description: 'Filter by source (e.g. manual, file)' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'Paginated knowledge base entries' })
  @ApiStandardResponses()
  async listKnowledgeBase(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('source') source?: string,
    @Query('category') category?: string,
  ) {
    return this.ragService.findAll({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
      source,
      category,
    });
  }

  @Post('knowledge-base')
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  @ApiOperation({ summary: 'Create a manual knowledge base entry' })
  @ApiResponse({ status: 201, description: 'Entry created and embedded' })
  @ApiStandardResponses()
  async createKbEntry(@Body() dto: CreateKbEntryDto) {
    return this.ragService.upsertEntry({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      source: 'manual',
    });
  }

  @Patch('knowledge-base/:id')
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  @ApiOperation({ summary: 'Update a knowledge base entry' })
  @ApiParam({ name: 'id', description: 'Knowledge base entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry updated' })
  @ApiStandardResponses()
  async updateKbEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKbEntryDto,
  ) {
    return this.ragService.update(id, dto);
  }

  @Delete('knowledge-base/:id')
  @CheckPermissions({ module: 'chatbot', action: 'delete' })
  @ApiOperation({ summary: 'Delete a knowledge base entry' })
  @ApiParam({ name: 'id', description: 'Knowledge base entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  @ApiStandardResponses()
  async deleteKbEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.ragService.delete(id);
  }

  @Post('knowledge-base/sync')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  @ApiOperation({ summary: 'Sync knowledge base from database records' })
  @ApiResponse({ status: 200, description: 'Number of synced entries' })
  @ApiStandardResponses()
  async syncKnowledgeBase() {
    const count = await this.ragService.syncFromDatabase();
    return { synced: count };
  }

  // ═══════════════════════════════════════════════════════════
  //  FILES — Admin only
  // ═══════════════════════════════════════════════════════════

  @Post('knowledge-base/files')
  @CheckPermissions({ module: 'chatbot', action: 'create' })
  @ApiOperation({ summary: 'Upload a file to the knowledge base (PDF, DOCX, TXT)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded and queued for processing' })
  @ApiStandardResponses()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_KB_FILE_SIZE },
      fileFilter: (
        _req: unknown,
        file: { mimetype: string },
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        const allowed = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException({
              statusCode: 400,
              message: 'Only PDF, DOCX, and TXT files are allowed',
              error: 'INVALID_FILE_TYPE',
            }),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @CurrentUser() user: { id: string },
    @Req() req: { file?: Express.Multer.File },
  ) {
    if (!req.file) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'File is required',
        error: 'MISSING_FILE',
      });
    }
    validateFileContent(req.file.buffer, req.file.mimetype);
    return this.fileService.uploadFile(user.id, req.file);
  }

  @Get('knowledge-base/files')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  @ApiOperation({ summary: 'List uploaded knowledge base files' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Paginated file list' })
  @ApiStandardResponses()
  async listFiles(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.fileService.listFiles({
      page: page ? parseInt(page, 10) : 1,
      perPage: perPage ? parseInt(perPage, 10) : 20,
    });
  }

  @Post('knowledge-base/files/:id/process')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  @ApiOperation({ summary: 'Trigger processing (embedding) of an uploaded file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'File processed successfully' })
  @ApiStandardResponses()
  async processFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.fileService.processFile(id);
    return { processed: true };
  }

  @Delete('knowledge-base/files/:id')
  @CheckPermissions({ module: 'chatbot', action: 'delete' })
  @ApiOperation({ summary: 'Delete an uploaded knowledge base file' })
  @ApiParam({ name: 'id', description: 'File UUID' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  @ApiStandardResponses()
  async deleteFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.fileService.deleteFile(id);
    return { deleted: true };
  }
}
