import { DashboardOpsController } from './ops.controller';
import { ReportFormat } from '@prisma/client';
import { REQUIRE_FEATURE_KEY } from '../../modules/platform/billing/feature.decorator';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });
const ORG_ID = 'org-00000000-0000-0000-0000-000000000001';
const mockTenant = { requireOrganizationId: jest.fn().mockReturnValue(ORG_ID) };

function buildController() {
  const generateReport = fn({ reportId: 'r-1', format: ReportFormat.JSON, data: {}, status: 'COMPLETED' });
  const listActivity = fn({ data: [] });
  const controller = new DashboardOpsController(generateReport as never, listActivity as never, mockTenant as never);
  return { controller, generateReport, listActivity };
}

const buildRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
});

describe('DashboardOpsController', () => {
  it('generateReportEndpoint — calls handler with body', async () => {
    const { controller, generateReport } = buildController();
    const res = buildRes();
    await controller.generateReportEndpoint(
      { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never,
      res as never,
    );
    expect(generateReport.execute).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REVENUE' }),
    );
  });

  it('generateReportEndpoint — sends Excel buffer when format is EXCEL', async () => {
    const excelBuffer = Buffer.from('excel-data');
    const generateReport = fn({ reportId: 'r-1', format: ReportFormat.EXCEL, excelBuffer, status: 'COMPLETED' });
    const listActivity = fn();
    const controller = new DashboardOpsController(generateReport as never, listActivity as never, mockTenant as never);
    const res = buildRes();
    await controller.generateReportEndpoint(
      { type: 'REVENUE', from: '2026-01-01', to: '2026-01-31', requestedBy: 'u-1' } as never,
      res as never,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.send).toHaveBeenCalledWith(excelBuffer);
  });

  it('listActivityEndpoint — calls handler with query and organizationId from tenant context', async () => {
    const { controller, listActivity } = buildController();
    await controller.listActivityEndpoint({ page: 1, limit: 10 } as never);
    expect(listActivity.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, organizationId: ORG_ID }),
    );
  });
});

describe('@RequireFeature metadata — ADVANCED_REPORTS', () => {
  it.each([
    'generateReportEndpoint',
  ])('annotates %s with FeatureKey.ADVANCED_REPORTS', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardOpsController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.ADVANCED_REPORTS);
  });
});

describe('@RequireFeature metadata — ACTIVITY_LOG', () => {
  it.each([
    'listActivityEndpoint',
  ])('annotates %s with FeatureKey.ACTIVITY_LOG', (method) => {
    const meta = Reflect.getMetadata(
      REQUIRE_FEATURE_KEY,
      (DashboardOpsController.prototype as Record<string, unknown>)[method] as object,
    );
    expect(meta).toBe(FeatureKey.ACTIVITY_LOG);
  });
});
