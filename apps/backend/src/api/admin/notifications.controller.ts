import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DeliveryChannel, DeliveryStatus } from '@prisma/client';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { ListNotificationDeliveryLogHandler } from '../../modules/platform/admin/list-notification-delivery-log/list-notification-delivery-log.handler';

const VALID_STATUSES = new Set<string>(Object.values(DeliveryStatus));
const VALID_CHANNELS = new Set<string>(Object.values(DeliveryChannel));

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminNotificationsController {
  constructor(private readonly handler: ListNotificationDeliveryLogHandler) {}

  @Get('delivery-log')
  @ApiOperation({ summary: 'List notification delivery log across all tenants' })
  @ApiQuery({ name: 'organizationId', required: false, description: 'Filter by organization UUID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by delivery status' })
  @ApiQuery({ name: 'channel', required: false, description: 'Filter by delivery channel' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page (default: 50, max: 200)' })
  list(
    @Query('organizationId') organizationId?: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const validatedStatus =
      status && VALID_STATUSES.has(status) ? (status as DeliveryStatus) : undefined;
    const validatedChannel =
      channel && VALID_CHANNELS.has(channel) ? (channel as DeliveryChannel) : undefined;

    return this.handler.execute({
      organizationId: organizationId?.trim() || undefined,
      status: validatedStatus,
      channel: validatedChannel,
      page: Math.max(1, Number(page ?? 1)),
      perPage: Math.min(Math.max(1, Number(perPage ?? 50)), 200),
    });
  }
}
