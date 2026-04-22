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
import { StartImpersonationHandler } from '../../modules/platform/admin/start-impersonation/start-impersonation.handler';
import { EndImpersonationHandler } from '../../modules/platform/admin/end-impersonation/end-impersonation.handler';
import { ListImpersonationSessionsHandler } from '../../modules/platform/admin/list-impersonation-sessions/list-impersonation-sessions.handler';
import { StartImpersonationDto } from './dto/impersonation.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/impersonation')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminImpersonationController {
  constructor(
    private readonly startHandler: StartImpersonationHandler,
    private readonly endHandler: EndImpersonationHandler,
    private readonly listHandler: ListImpersonationSessionsHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Start an impersonation session (15-min shadow JWT)' })
  start(
    @Body() dto: StartImpersonationDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ) {
    return this.startHandler.execute({
      superAdminUserId: user.sub,
      organizationId: dto.organizationId,
      targetUserId: dto.targetUserId,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End an active impersonation session manually' })
  async end(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.endHandler.execute({
      sessionId: id,
      superAdminUserId: user.sub,
      endedReason: 'manual',
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List impersonation sessions (active + historical)' })
  list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('active') active?: string,
    @Query('superAdminUserId') superAdminUserId?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const parsedActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.listHandler.execute({
      page: Math.max(1, Number(page ?? 1)),
      perPage: Math.min(Math.max(1, Number(perPage ?? 50)), 200),
      active: parsedActive,
      superAdminUserId: superAdminUserId?.trim() || undefined,
      organizationId: organizationId?.trim() || undefined,
    });
  }
}
