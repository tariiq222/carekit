import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SuperAdminActionType } from '@prisma/client';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { ApiStandardResponses } from '../../common/swagger';
import { ListAuditLogHandler } from '../../modules/platform/admin/list-audit-log/list-audit-log.handler';
import { AuditLogListResponseDto } from './dto/admin-response.dto';

const VALID_ACTION_TYPES = new Set<string>(Object.values(SuperAdminActionType));

@ApiTags('Admin / Audit Log')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('admin/audit-log')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminAuditLogController {
  constructor(private readonly handler: ListAuditLogHandler) {}

  @Get()
  @ApiOperation({ summary: 'List super-admin audit log entries' })
  @ApiOkResponse({ type: AuditLogListResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'perPage', required: false, type: Number, example: 50 })
  @ApiQuery({ name: 'actionType', required: false, enum: SuperAdminActionType })
  @ApiQuery({ name: 'superAdminUserId', required: false, type: String, description: 'Filter by super-admin user UUID' })
  @ApiQuery({ name: 'organizationId', required: false, type: String, description: 'Filter by organization UUID' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO 8601 start date', example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO 8601 end date', example: '2026-12-31T23:59:59Z' })
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
