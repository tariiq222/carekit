import { Controller, Get, UseGuards } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { PrismaService } from '../../../../infrastructure/database';

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal/summary')
export class MobileClientSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get account summary statistics for the authenticated client' })
  @ApiOkResponse({
    description: 'Total bookings count, last visit date, and outstanding balance.',
    schema: { type: 'object' },
  })
  async summary(@CurrentUser() user: JwtUser) {
    const [totalBookings, lastBooking, unpaidInvoices] = await Promise.all([
      this.prisma.booking.count({ where: { clientId: user.sub } }),
      this.prisma.booking.findFirst({
        where: { clientId: user.sub, status: BookingStatus.COMPLETED },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          clientId: user.sub,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalBookings,
      lastVisit: lastBooking?.scheduledAt ?? null,
      outstandingBalance: Number(unpaidInvoices._sum.total ?? 0),
    };
  }
}
