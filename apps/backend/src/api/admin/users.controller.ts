import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { SearchUsersHandler } from '../../modules/platform/admin/search-users/search-users.handler';
import { ResetUserPasswordHandler } from '../../modules/platform/admin/reset-user-password/reset-user-password.handler';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/users')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminUsersController {
  constructor(
    private readonly searchHandler: SearchUsersHandler,
    private readonly resetHandler: ResetUserPasswordHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Cross-tenant user search' })
  search(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    return this.searchHandler.execute({
      page: Math.max(1, Number(page ?? 1)),
      perPage: Math.min(Math.max(1, Number(perPage ?? 20)), 100),
      search: search?.trim() ? search.trim() : undefined,
      organizationId: organizationId?.trim() ? organizationId.trim() : undefined,
    });
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Issue a temporary password for a user (audited)' })
  async resetPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.resetHandler.execute({
      targetUserId: id,
      superAdminUserId: user.sub,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
