import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto.js';
import { UnregisterFcmTokenDto } from './dto/unregister-fcm-token.dto.js';
import { NotificationListQueryDto } from './dto/notification-list-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /notifications — List user's notifications
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'notifications', action: 'view' })
  async findAll(
    @Query() query: NotificationListQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.findAll(user.id, query);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /notifications/unread-count
  // ═══════════════════════════════════════════════════════════════

  @Get('unread-count')
  @CheckPermissions({ module: 'notifications', action: 'view' })
  async getUnreadCount(@CurrentUser() user: { id: string }) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { count };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /notifications/read-all — must be before :id routes
  // ═══════════════════════════════════════════════════════════════

  @Patch('read-all')
  @HttpCode(200)
  @CheckPermissions({ module: 'notifications', action: 'update' })
  async markAllAsRead(@CurrentUser() user: { id: string }) {
    await this.notificationsService.markAllAsRead(user.id);
    return { updated: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /notifications/:id/read — Mark single as read
  // ═══════════════════════════════════════════════════════════════

  @Patch(':id/read')
  @HttpCode(200)
  @CheckPermissions({ module: 'notifications', action: 'update' })
  async markAsRead(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /notifications/fcm-token — Register FCM token
  // ═══════════════════════════════════════════════════════════════

  @Post('fcm-token')
  @CheckPermissions({ module: 'notifications', action: 'update' })
  async registerFcmToken(
    @Body() dto: RegisterFcmTokenDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.notificationsService.registerFcmToken(user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE /notifications/fcm-token — Unregister FCM token
  // ═══════════════════════════════════════════════════════════════

  @Delete('fcm-token')
  @HttpCode(200)
  @CheckPermissions({ module: 'notifications', action: 'update' })
  async unregisterFcmToken(
    @Body() dto: UnregisterFcmTokenDto,
    @CurrentUser() user: { id: string },
  ) {
    await this.notificationsService.unregisterFcmToken(user.id, dto.token);
    return { deleted: true };
  }
}
