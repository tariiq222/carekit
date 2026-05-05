import {
  Controller, Get, Req, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { UserId } from '../../common/auth/user-id.decorator';
import { GetDashboardStatsHandler } from '../../modules/dashboard/get-dashboard-stats/get-dashboard-stats.handler';

interface RequestWithUser {
  user?: { membershipRole?: string | null };
}

@ApiTags('Dashboard / Stats')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/stats')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardStatsController {
  constructor(private readonly getStats: GetDashboardStatsHandler) {}

  @Get()
  @ApiOperation({ summary: 'Get dashboard home page statistics for today' })
  @ApiOkResponse({
    description: 'Dashboard statistics aggregated for today',
    schema: {
      type: 'object',
      properties: {
        todayBookings: { type: 'number' },
        pendingBookings: { type: 'number' },
        completedToday: { type: 'number' },
        revenueToday: { type: 'number' },
        activeClients: { type: 'number' },
        newClientsThisMonth: { type: 'number' },
      },
    },
  })
  getStatsEndpoint(@UserId() userId: string, @Req() req: RequestWithUser) {
    return this.getStats.execute({
      membershipRole: req.user?.membershipRole ?? null,
      userId,
    });
  }
}
