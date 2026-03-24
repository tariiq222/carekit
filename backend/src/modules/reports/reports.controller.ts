import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { ReportsService } from './reports.service.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/revenue?dateFrom=&dateTo=&practitionerId=
  // ═══════════════════════════════════════════════════════════════

  @Get('revenue')
  @CheckPermissions({ module: 'reports', action: 'view' })
  async getRevenue(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('practitionerId') practitionerId?: string,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'dateFrom and dateTo are required',
        error: 'VALIDATION_ERROR',
      });
    }
    const data = await this.reportsService.getRevenueReport(
      dateFrom,
      dateTo,
      practitionerId,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/bookings?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('bookings')
  @CheckPermissions({ module: 'reports', action: 'view' })
  async getBookings(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'dateFrom and dateTo are required',
        error: 'VALIDATION_ERROR',
      });
    }
    const data = await this.reportsService.getBookingReport(dateFrom, dateTo);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/practitioners/:id?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('practitioners/:id')
  @CheckPermissions({ module: 'reports', action: 'view' })
  async getPractitioner(
    @Param('id', uuidPipe) id: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'dateFrom and dateTo are required',
        error: 'VALIDATION_ERROR',
      });
    }
    const data = await this.reportsService.getPractitionerReport(
      id,
      dateFrom,
      dateTo,
    );
    return { success: true, data };
  }
}
