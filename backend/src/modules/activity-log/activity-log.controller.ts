import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { ActivityLogService } from './activity-log.service.js';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto.js';

@ApiTags('Activity Log')
@ApiBearerAuth()
@Controller('activity-log')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  @Get()
  @CheckPermissions({ module: 'activity-log', action: 'view' })
  @ApiOperation({ summary: 'List activity logs with filters and pagination' })
  findAll(@Query() query: ActivityLogQueryDto) {
    return this.service.findAll({
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      module: query.module,
      action: query.action,
      userId: query.userId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
  }

  @Get(':id')
  @CheckPermissions({ module: 'activity-log', action: 'view' })
  @ApiOperation({ summary: 'Get a single activity log entry' })
  findOne(@Param('id', uuidPipe) id: string) {
    return this.service.findOne(id);
  }
}
