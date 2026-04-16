import { Controller, Get, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';

export class EmployeeClientListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @IsOptional() @IsString() search?: string;
}

@UseGuards(JwtGuard)
@Controller('mobile/employee/clients')
export class MobileEmployeeClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listMyClients(
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeClientListQuery,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const clientIdRows = await this.prisma.booking.findMany({
      where: { employeeId: user.sub },
      select: { clientId: true },
      distinct: ['clientId'],
    });

    const ids = clientIdRows.map((b) => b.clientId);

    const where = {
      id: { in: ids },
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { phone: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  @Get(':clientId/history')
  clientHistory(
    @CurrentUser() user: JwtUser,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.prisma.booking.findMany({
      where: { employeeId: user.sub, clientId },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
    });
  }
}
