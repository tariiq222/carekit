import { DashboardOrganizationSettingsController } from './organization-settings.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createService = fn({ id: 'svc-1' });
  const updateService = fn({ id: 'svc-1' });
  const listServices = fn({ data: [] });
  const archiveService = fn({ id: 'svc-1' });
  const upsertBranding = fn({ id: 'br-1' });
  const getBranding = fn({ id: 'br-1' });
  const createIntakeForm = fn({ id: 'if-1' });
  const getIntakeForm = fn({ id: 'if-1' });
  const listIntakeForms = fn({ data: [] });
  const submitRating = fn({ id: 'r-1' });
  const listRatings = fn({ data: [] });
  const controller = new DashboardOrganizationSettingsController(
    createService as never, updateService as never, listServices as never, archiveService as never,
    upsertBranding as never, getBranding as never,
    createIntakeForm as never, getIntakeForm as never, listIntakeForms as never,
    submitRating as never, listRatings as never,
  );
  return { controller, createService, updateService, listServices, archiveService, upsertBranding, getBranding, createIntakeForm, getIntakeForm, listIntakeForms, submitRating, listRatings };
}

describe('DashboardOrganizationSettingsController', () => {
  it('createServiceEndpoint — passes tenantId', async () => {
    const { controller, createService } = buildController();
    await controller.createServiceEndpoint(TENANT, { nameAr: 'خدمة' } as never);
    expect(createService.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listServicesEndpoint — passes tenantId', async () => {
    const { controller, listServices } = buildController();
    await controller.listServicesEndpoint(TENANT, {} as never);
    expect(listServices.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('updateServiceEndpoint — passes tenantId and id', async () => {
    const { controller, updateService } = buildController();
    await controller.updateServiceEndpoint(TENANT, 'svc-1', {} as never);
    expect(updateService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, serviceId: 'svc-1' }),
    );
  });

  it('archiveServiceEndpoint — passes tenantId and id', async () => {
    const { controller, archiveService } = buildController();
    await controller.archiveServiceEndpoint(TENANT, 'svc-1');
    expect(archiveService.execute).toHaveBeenCalledWith({ tenantId: TENANT, serviceId: 'svc-1' });
  });

  it('upsertBrandingEndpoint — passes tenantId', async () => {
    const { controller, upsertBranding } = buildController();
    await controller.upsertBrandingEndpoint(TENANT, { logoUrl: 'https://example.com/logo.png' } as never);
    expect(upsertBranding.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getBrandingEndpoint — passes tenantId', async () => {
    const { controller, getBranding } = buildController();
    await controller.getBrandingEndpoint(TENANT);
    expect(getBranding.execute).toHaveBeenCalledWith({ tenantId: TENANT });
  });

  it('createIntakeFormEndpoint — passes tenantId', async () => {
    const { controller, createIntakeForm } = buildController();
    await controller.createIntakeFormEndpoint(TENANT, { title: 'Form' } as never);
    expect(createIntakeForm.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listIntakeFormsEndpoint — passes tenantId', async () => {
    const { controller, listIntakeForms } = buildController();
    await controller.listIntakeFormsEndpoint(TENANT, {} as never);
    expect(listIntakeForms.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('submitRatingEndpoint — passes tenantId', async () => {
    const { controller, submitRating } = buildController();
    await controller.submitRatingEndpoint(TENANT, { bookingId: 'b-1', score: 5 } as never);
    expect(submitRating.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listRatingsEndpoint — passes tenantId', async () => {
    const { controller, listRatings } = buildController();
    await controller.listRatingsEndpoint(TENANT, {} as never);
    expect(listRatings.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});