import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { ListBookingsHandler } from '../../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal')
export class MobileClientHomeController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getClient: GetClientHandler,
  ) {}

  @Get('home')
  @ApiOperation({ summary: 'Get home screen aggregated data for the authenticated client' })
  @ApiOkResponse({
    description: 'Client profile, upcoming bookings, unread notifications, and recent payments.',
    schema: { type: 'object' },
  })
  async home(@CurrentUser() user: JwtUser) {
    const now = new Date();
    const [upcomingResult, notificationsResult, paymentsResult, profile] = await Promise.all([
      this.listBookings.execute({ clientId: user.sub, fromDate: now, page: 1, limit: 5 }),
      this.listNotifications.execute({ recipientId: user.sub, unreadOnly: true, page: 1, limit: 5 }),
      this.listPayments.execute({ clientId: user.sub, page: 1, limit: 3 }),
      this.getClient.execute({ clientId: user.sub }),
    ]);

    return {
      profile,
      upcomingBookings: (upcomingResult as { data?: unknown[] }).data ?? upcomingResult,
      unreadNotifications: (notificationsResult as { data?: unknown[] }).data ?? notificationsResult,
      recentPayments: (paymentsResult as { data?: unknown[] }).data ?? paymentsResult,
    };
  }
}
