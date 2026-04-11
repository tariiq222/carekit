import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../../common/decorators/check-permissions.decorator.js';
import { uuidPipe } from '../../../common/pipes/uuid.pipe.js';
import { EmailTemplatesService } from './email-templates.service.js';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto.js';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto.js';
import { ApiStandardResponses } from '../../../common/swagger/api-responses.decorator.js';

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('email-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'List all email templates' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async findAll() {
    return this.service.findAll();
  }

  @Get(':slug')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({ summary: 'Get email template by slug' })
  @ApiParam({
    name: 'slug',
    description: 'Template slug (e.g. booking-confirmed)',
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Template not found' })
  @ApiStandardResponses()
  async findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  @ApiOperation({ summary: 'Update email template content' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':slug/preview')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  @ApiOperation({
    summary: 'Preview rendered email template with sample context',
  })
  @ApiParam({ name: 'slug', description: 'Template slug' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  async preview(
    @Param('slug') slug: string,
    @Body() dto: PreviewEmailTemplateDto,
  ) {
    return this.service.preview(slug, dto.context, dto.lang);
  }
}
