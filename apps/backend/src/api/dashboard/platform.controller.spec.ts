import { DashboardPlatformController } from './platform.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createProblemReport = fn({ id: 'pr-1' });
  const listProblemReports = fn({ data: [] });
  const updateProblemReportStatus = fn({ id: 'pr-1' });
  const upsertIntegration = fn({ id: 'int-1' });
  const listIntegrations = fn([]);
  const controller = new DashboardPlatformController(
    createProblemReport as never,
    listProblemReports as never,
    updateProblemReportStatus as never,
    upsertIntegration as never,
    listIntegrations as never,
  );
  return {
    controller,
    createProblemReport,
    listProblemReports,
    updateProblemReportStatus,
    upsertIntegration,
    listIntegrations,
  };
}

describe('DashboardPlatformController', () => {
  it('createProblemReportEndpoint — delegates body', async () => {
    const { controller, createProblemReport } = buildController();
    await controller.createProblemReportEndpoint({ title: 'Bug' } as never);
    expect(createProblemReport.execute).toHaveBeenCalledWith({ title: 'Bug' });
  });

  it('listProblemReportsEndpoint — delegates query', async () => {
    const { controller, listProblemReports } = buildController();
    await controller.listProblemReportsEndpoint({} as never);
    expect(listProblemReports.execute).toHaveBeenCalledWith({});
  });

  it('updateProblemReportStatusEndpoint — passes id', async () => {
    const { controller, updateProblemReportStatus } = buildController();
    await controller.updateProblemReportStatusEndpoint('pr-1', { status: 'RESOLVED' } as never);
    expect(updateProblemReportStatus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pr-1' }),
    );
  });

  it('upsertIntegrationEndpoint — delegates body', async () => {
    const { controller, upsertIntegration } = buildController();
    await controller.upsertIntegrationEndpoint({ provider: 'zoom' } as never);
    expect(upsertIntegration.execute).toHaveBeenCalledWith({ provider: 'zoom' });
  });

  it('listIntegrationsEndpoint — calls execute with no args', async () => {
    const { controller, listIntegrations } = buildController();
    await controller.listIntegrationsEndpoint();
    expect(listIntegrations.execute).toHaveBeenCalledWith();
  });

  it('does not expose tenant-side feature flag mutation', () => {
    const { controller } = buildController();
    expect('updateFeatureFlagEndpoint' in controller).toBe(false);
  });
});
