import { Controller, Get, UseGuards } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../../infrastructure/database';

@UseGuards(JwtGuard)
@Controller('mobile/client/portal/summary')
export class MobileClientSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
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
