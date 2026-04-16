import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { JwtGuard } from '../../../../common/guards/jwt.guard';
import { CurrentUser, JwtUser } from '../../../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { PrismaService } from '../../../../infrastructure/database';

export class UpcomingQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

const UPCOMING_STATUSES: BookingStatus[] = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard)
@Controller('mobile/client/portal/upcoming')
export class MobileClientUpcomingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List upcoming bookings for the authenticated client' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)', example: 10 })
  @ApiOkResponse({
    description: 'Paginated list of upcoming bookings with status PENDING or CONFIRMED.',
    schema: { type: 'object' },
  })
  async upcoming(
    @CurrentUser() user: JwtUser,
    @Query() q: UpcomingQuery,
  ) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 10;
    const now = new Date();

    const where = {
      clientId: user.sub,
      scheduledAt: { gte: now },
      status: { in: UPCOMING_STATUSES },
    };

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
