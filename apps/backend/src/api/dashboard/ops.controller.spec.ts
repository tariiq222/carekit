import { DashboardOpsController } from './ops.controller';
import { ReportFormat } from '@prisma/client';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const generateReport = fn({ reportId: 'r-1', format: ReportFormat.JSON, data: {}, status: 'COMPLETED' });
  const listActivity = fn({ data: [] });
  const controller = new DashboardOpsController(generateReport as never, listActivity as never);
  return { controller, generateReport, listActivity };
}

const buildRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe('DashboardOpsController', () => {
  it('generateReportEndpoint — passes tenantId', async () => {
    const { controller, generateReport } = buildController();
    const res = buildRes();
    await controller.generateReportEndpoint(TENANT, { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never, res as never);
    expect(generateReport.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('generateReportEndpoint — sends Excel buffer when format is EXCEL', async () => {
    const excelBuffer = Buffer.from('excel-data');
    const generateReport = fn({ reportId: 'r-1', format: ReportFormat.EXCEL, excelBuffer, status: 'COMPLETED' });
    const listActivity = fn();
    const controller = new DashboardOpsController(generateReport as never, listActivity as never);
    const res = buildRes();
    await controller.generateReportEndpoint(TENANT, { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(res.send).toHaveBeenCalledWith(excelBuffer);
  });

  it('listActivityEndpoint — passes tenantId', async () => {
    const { controller, listActivity } = buildController();
    await controller.listActivityEndpoint(TENANT, {} as never);
    expect(listActivity.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});