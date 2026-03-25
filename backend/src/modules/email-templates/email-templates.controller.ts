import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { EmailTemplatesService } from './email-templates.service.js';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto.js';
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto.js';

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('email-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async findAll() {
    return this.service.findAll();
  }

  @Get(':slug')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async findBySlug(@Param('slug') slug: string) {
    return this.service.findBySlug(slug);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'whitelabel', action: 'edit' })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(':slug/preview')
  @CheckPermissions({ module: 'whitelabel', action: 'view' })
  async preview(
    @Param('slug') slug: string,
    @Body() dto: PreviewEmailTemplateDto,
  ) {
    return this.service.preview(slug, dto.context, dto.lang);
  }
}
