import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsBoolean, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ListFeatureFlagsAdminHandler } from '../../modules/platform/admin/list-feature-flags-admin/list-feature-flags-admin.handler';
import { UpdateFeatureFlagAdminHandler } from '../../modules/platform/admin/update-feature-flag-admin/update-feature-flag-admin.handler';

class UpdateFeatureFlagAdminDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organizationId!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ minLength: 10, maxLength: 500 })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/feature-flags')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminFeatureFlagsController {
  constructor(
    private readonly listHandler: ListFeatureFlagsAdminHandler,
    private readonly updateHandler: UpdateFeatureFlagAdminHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List feature flags and organization overrides' })
  list(@Query('organizationId', new ParseUUIDPipe()) organizationId: string) {
    return this.listHandler.execute({ organizationId });
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Create or update a feature flag override for an organization' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagAdminDto,
    @CurrentUser() user: { sub?: string; id?: string },
    @Req() req: Request,
  ) {
    return this.updateHandler.execute({
      organizationId: dto.organizationId,
      key,
      enabled: dto.enabled,
      superAdminUserId: user.sub ?? user.id ?? '',
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
