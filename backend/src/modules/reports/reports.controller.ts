import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { ReportsService } from './reports.service.js';
import { ExportService } from './export.service.js';
import { DashboardStatsService } from './dashboard-stats.service.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
    private readonly dashboardStatsService: DashboardStatsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/revenue?dateFrom=&dateTo=&practitionerId=
  // ═══════════════════════════════════════════════════════════════

  @Get('revenue')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Get revenue report (SQL aggregated)' })
  async getRevenue(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('practitionerId') practitionerId?: string,
    @Query('branchId') branchId?: string,
  ) {
    this.validateDateRange(dateFrom, dateTo);
    const data = await this.reportsService.getRevenueReport(
      dateFrom,
      dateTo,
      practitionerId,
      branchId,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/revenue/export?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('revenue/export')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Export revenue report as CSV' })
  async exportRevenue(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response,
    @Query('branchId') branchId?: string,
  ) {
    this.validateDateRange(dateFrom, dateTo);
    const csv = await this.exportService.exportRevenueCsv(dateFrom, dateTo, branchId);
    this.sendCsv(res, csv, `revenue-${dateFrom}-to-${dateTo}.csv`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/bookings?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('bookings')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Get booking report (SQL aggregated)' })
  async getBookings(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('branchId') branchId?: string,
  ) {
    this.validateDateRange(dateFrom, dateTo);
    const data = await this.reportsService.getBookingReport(dateFrom, dateTo, branchId);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/bookings/export?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('bookings/export')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Export bookings as CSV' })
  async exportBookings(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response,
    @Query('branchId') branchId?: string,
  ) {
    this.validateDateRange(dateFrom, dateTo);
    const csv = await this.exportService.exportBookingsCsv(dateFrom, dateTo, branchId);
    this.sendCsv(res, csv, `bookings-${dateFrom}-to-${dateTo}.csv`);
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/patients/export
  // ═══════════════════════════════════════════════════════════════

  @Get('patients/export')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Export all patients as CSV' })
  async exportPatients(@Res() res: Response) {
    const csv = await this.exportService.exportPatientsCsv();
    this.sendCsv(res, csv, 'patients.csv');
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/practitioners/:id?dateFrom=&dateTo=
  // ═══════════════════════════════════════════════════════════════

  @Get('practitioners/:id')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Get practitioner performance report' })
  async getPractitioner(
    @Param('id', uuidPipe) id: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    this.validateDateRange(dateFrom, dateTo);
    const data = await this.reportsService.getPractitionerReport(
      id,
      dateFrom,
      dateTo,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /reports/dashboard?branchId=
  // ═══════════════════════════════════════════════════════════════

  @Get('dashboard')
  @CheckPermissions({ module: 'reports', action: 'view' })
  @ApiOperation({ summary: 'Get dashboard KPI stats (cached 5 min)' })
  async getDashboardStats(@Query('branchId') branchId?: string) {
    const data = await this.dashboardStatsService.getStats(branchId);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════

  private validateDateRange(dateFrom: string, dateTo: string): void {
    if (!dateFrom || !dateTo) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'dateFrom and dateTo are required',
        error: 'VALIDATION_ERROR',
      });
    }
  }

  private sendCsv(res: Response, csv: string, filename: string): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }
}
