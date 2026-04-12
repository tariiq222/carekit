import { DashboardPlatformController } from './platform.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createProblemReport = fn({ id: 'pr-1' });
  const listProblemReports = fn({ data: [] });
  const updateProblemReportStatus = fn({ id: 'pr-1' });
  const upsertIntegration = fn({ id: 'int-1' });
  const listIntegrations = fn({ data: [] });
  const controller = new DashboardPlatformController(
    createProblemReport as never, listProblemReports as never,
    updateProblemReportStatus as never, upsertIntegration as never, listIntegrations as never,
  );
  return { controller, createProblemReport, listProblemReports, updateProblemReportStatus, upsertIntegration, listIntegrations };
}

describe('DashboardPlatformController', () => {
  it('createProblemReportEndpoint — passes tenantId', async () => {
    const { controller, createProblemReport } = buildController();
    await controller.createProblemReportEndpoint(TENANT, { title: 'Bug' } as never);
    expect(createProblemReport.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listProblemReportsEndpoint — passes tenantId', async () => {
    const { controller, listProblemReports } = buildController();
    await controller.listProblemReportsEndpoint(TENANT, {} as never);
    expect(listProblemReports.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateProblemReportStatusEndpoint — passes tenantId and id', async () => {
    const { controller, updateProblemReportStatus } = buildController();
    await controller.updateProblemReportStatusEndpoint(TENANT, 'pr-1', { status: 'RESOLVED' } as never);
    expect(updateProblemReportStatus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, id: 'pr-1' }),
    );
  });

  it('upsertIntegrationEndpoint — passes tenantId', async () => {
    const { controller, upsertIntegration } = buildController();
    await controller.upsertIntegrationEndpoint(TENANT, { provider: 'zoom' } as never);
    expect(upsertIntegration.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listIntegrationsEndpoint — passes tenantId', async () => {
    const { controller, listIntegrations } = buildController();
    await controller.listIntegrationsEndpoint(TENANT);
    expect(listIntegrations.execute).toHaveBeenCalledWith(TENANT);
  });
});