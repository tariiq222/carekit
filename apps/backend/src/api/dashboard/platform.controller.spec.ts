import { DashboardPlatformController } from './platform.controller';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createProblemReport = fn({ id: 'pr-1' });
  const listProblemReports = fn({ data: [] });
  const updateProblemReportStatus = fn({ id: 'pr-1' });
  const upsertIntegration = fn({ id: 'int-1' });
  const listIntegrations = fn([]);
  const listFeatureFlags = fn([]);
  const getFeatureFlagMap = fn({});
  const updateFeatureFlag = fn({ key: 'multi_branch', enabled: false });
  const controller = new DashboardPlatformController(
    createProblemReport as never,
    listProblemReports as never,
    updateProblemReportStatus as never,
    upsertIntegration as never,
    listIntegrations as never,
    listFeatureFlags as never,
    getFeatureFlagMap as never,
    updateFeatureFlag as never,
  );
  return {
    controller,
    createProblemReport,
    listProblemReports,
    updateProblemReportStatus,
    upsertIntegration,
    listIntegrations,
    listFeatureFlags,
    getFeatureFlagMap,
    updateFeatureFlag,
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

  it('listFeatureFlagsEndpoint — calls execute with no args', async () => {
    const { controller, listFeatureFlags } = buildController();
    await controller.listFeatureFlagsEndpoint();
    expect(listFeatureFlags.execute).toHaveBeenCalledWith();
  });

  it('featureFlagMapEndpoint — calls execute with no args', async () => {
    const { controller, getFeatureFlagMap } = buildController();
    await controller.featureFlagMapEndpoint();
    expect(getFeatureFlagMap.execute).toHaveBeenCalledWith();
  });

  it('updateFeatureFlagEndpoint — passes key and enabled', async () => {
    const { controller, updateFeatureFlag } = buildController();
    await controller.updateFeatureFlagEndpoint('multi_branch', { enabled: false } as never);
    expect(updateFeatureFlag.execute).toHaveBeenCalledWith({ key: 'multi_branch', enabled: false });
  });
});
