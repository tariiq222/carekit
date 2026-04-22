import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuperAdminActionType } from '@prisma/client';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { ListAuditLogHandler } from '../../modules/platform/admin/list-audit-log/list-audit-log.handler';

const VALID_ACTION_TYPES = new Set<string>(Object.values(SuperAdminActionType));

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/audit-log')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminAuditLogController {
  constructor(private readonly handler: ListAuditLogHandler) {}

  @Get()
  @ApiOperation({ summary: 'Read-only paginated super-admin action log' })
  list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('actionType') actionType?: string,
    @Query('superAdminUserId') superAdminUserId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const validatedActionType =
      actionType && VALID_ACTION_TYPES.has(actionType)
        ? (actionType as SuperAdminActionType)
        : undefined;
    return this.handler.execute({
      page: Math.max(1, Number(page ?? 1)),
      perPage: Math.min(Math.max(1, Number(perPage ?? 50)), 200),
      actionType: validatedActionType,
      superAdminUserId: superAdminUserId?.trim() || undefined,
      organizationId: organizationId?.trim() || undefined,
      from: fromDate && !isNaN(fromDate.getTime()) ? fromDate : undefined,
      to: toDate && !isNaN(toDate.getTime()) ? toDate : undefined,
    });
  }
}
