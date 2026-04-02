/**
 * ReportsController — Unit Tests (delegation)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from '../../../src/modules/reports/reports.controller.js';
import { ReportsService } from '../../../src/modules/reports/reports.service.js';
import { ExportService } from '../../../src/modules/reports/export.service.js';
import { DashboardStatsService } from '../../../src/modules/reports/dashboard-stats.service.js';

const mockReportsService = { getRevenueReport: jest.fn(), getBookingReport: jest.fn(), getPractitionerReport: jest.fn() };
const mockExportService = { exportRevenueCsv: jest.fn(), exportBookingsCsv: jest.fn(), exportPatientsCsv: jest.fn() };
const mockDashboardStatsService = { getStats: jest.fn() };

const mockRes = {
  setHeader: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
};

describe('ReportsController', () => {
  let controller: ReportsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: mockReportsService },
        { provide: ExportService, useValue: mockExportService },
        { provide: DashboardStatsService, useValue: mockDashboardStatsService },
      ],
    }).compile();
    controller = module.get(ReportsController);
  });

  it('getRevenue → reportsService.getRevenueReport()', async () => {
    mockReportsService.getRevenueReport.mockResolvedValue({});
    await controller.getRevenue('2026-01-01', '2026-01-31', undefined);
    expect(mockReportsService.getRevenueReport).toHaveBeenCalled();
  });

it('getBookings → reportsService.getBookingReport()', async () => {
    mockReportsService.getBookingReport.mockResolvedValue({});
    await controller.getBookings('2026-01-01', '2026-01-31', undefined);
    expect(mockReportsService.getBookingReport).toHaveBeenCalled();
  });

  it('getDashboardStats → dashboardStatsService.getDashboardStats()', async () => {
    mockDashboardStatsService.getStats.mockResolvedValue({});
    await controller.getDashboardStats(undefined);
    expect(mockDashboardStatsService.getStats).toHaveBeenCalled();
  });

  it('exportRevenue → exportService.exportRevenueCsv()', async () => {
    mockExportService.exportRevenueCsv.mockResolvedValue('csv-data');
    await controller.exportRevenue('2026-01-01', '2026-01-31', undefined, mockRes as any).catch(() => {});
    expect(mockExportService.exportRevenueCsv).toHaveBeenCalled();
  });

  it('exportPatients → exportService.exportPatientsCsv()', async () => {
    mockExportService.exportPatientsCsv.mockResolvedValue('csv-data');
    await controller.exportPatients(mockRes as any);
    expect(mockExportService.exportPatientsCsv).toHaveBeenCalled();
  });
});
