import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { TenantId } from '../../../common/tenant/tenant.decorator';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';

export class EarningsQuery {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

@UseGuards(JwtGuard)
@Controller('mobile/employee/earnings')
export class MobileEmployeeEarningsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async earnings(
    @TenantId() tenantId: string,
    @CurrentUser() user: JwtUser,
    @Query() q: EarningsQuery,
  ) {
    const now = new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to
      ? new Date(q.to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        employeeId: user.sub,
        status: InvoiceStatus.PAID,
        paidAt: { gte: from, lte: to },
      },
      include: {
        payments: { select: { amount: true, method: true } },
      },
    });

    const totalEarnings = invoices.reduce((sum, inv) => sum + Number(inv.total), 0);
    const byMethod: Record<string, number> = {};
    for (const inv of invoices) {
      for (const p of inv.payments) {
        byMethod[p.method] = (byMethod[p.method] ?? 0) + Number(p.amount);
      }
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalEarnings,
      invoiceCount: invoices.length,
      byMethod,
    };
  }
}
