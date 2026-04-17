import { DashboardOrganizationSettingsController } from './organization-settings.controller';

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
  const deleteIntakeForm = fn(undefined);
  const submitRating = fn({ id: 'r-1' });
  const listRatings = fn({ data: [] });
  const getOrgSettings = fn({ id: 'os-1' });
  const upsertOrgSettings = fn({ id: 'os-1' });
  const getBookingSettings = fn({ id: 'bs-1' });
  const upsertBookingSettings = fn({ id: 'bs-1' });
  const setServiceBookingConfigs = fn({ id: 'sbc-1' });
  const getServiceBookingConfigs = fn({ id: 'sbc-1' });
  const listServiceEmployees = fn([]);
  const uploadLogo = fn({ fileId: 'f-1', url: 'https://example.com/logo.png' });
  const controller = new DashboardOrganizationSettingsController(
    createService as never, updateService as never, listServices as never, archiveService as never,
    upsertBranding as never, getBranding as never, uploadLogo as never,
    createIntakeForm as never, getIntakeForm as never, listIntakeForms as never,
    deleteIntakeForm as never, submitRating as never, listRatings as never,
    getOrgSettings as never, upsertOrgSettings as never,
    getBookingSettings as never, upsertBookingSettings as never,
    setServiceBookingConfigs as never, getServiceBookingConfigs as never,
    listServiceEmployees as never,
  );
  return { controller, createService, updateService, listServices, archiveService, upsertBranding, getBranding, uploadLogo, createIntakeForm, getIntakeForm, listIntakeForms, deleteIntakeForm, submitRating, listRatings, getOrgSettings, upsertOrgSettings, getBookingSettings, upsertBookingSettings, setServiceBookingConfigs, getServiceBookingConfigs };
}

describe('DashboardOrganizationSettingsController', () => {
  it('createServiceEndpoint — passes body', async () => {
    const { controller, createService } = buildController();
    await controller.createServiceEndpoint({ nameAr: 'خدمة' } as never);
    expect(createService.execute).toHaveBeenCalled();
  });

  it('listServicesEndpoint — passes query', async () => {
    const { controller, listServices } = buildController();
    await controller.listServicesEndpoint({} as never);
    expect(listServices.execute).toHaveBeenCalled();
  });

  it('updateServiceEndpoint — passes id', async () => {
    const { controller, updateService } = buildController();
    await controller.updateServiceEndpoint('svc-1', {} as never);
    expect(updateService.execute).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'svc-1' }),
    );
  });

  it('archiveServiceEndpoint — passes id', async () => {
    const { controller, archiveService } = buildController();
    await controller.archiveServiceEndpoint('svc-1');
    expect(archiveService.execute).toHaveBeenCalledWith({ serviceId: 'svc-1' });
  });

  it('upsertBrandingEndpoint — passes body', async () => {
    const { controller, upsertBranding } = buildController();
    await controller.upsertBrandingEndpoint({ logoUrl: 'https://example.com/logo.png' } as never);
    expect(upsertBranding.execute).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: 'https://example.com/logo.png' }));
  });

  it('getBrandingEndpoint — calls with no args', async () => {
    const { controller, getBranding } = buildController();
    await controller.getBrandingEndpoint();
    expect(getBranding.execute).toHaveBeenCalledWith();
  });

  it('createIntakeFormEndpoint — passes body', async () => {
    const { controller, createIntakeForm } = buildController();
    await controller.createIntakeFormEndpoint({ title: 'Form' } as never);
    expect(createIntakeForm.execute).toHaveBeenCalled();
  });

  it('listIntakeFormsEndpoint — passes query', async () => {
    const { controller, listIntakeForms } = buildController();
    await controller.listIntakeFormsEndpoint({} as never);
    expect(listIntakeForms.execute).toHaveBeenCalled();
  });

  it('submitRatingEndpoint — passes body', async () => {
    const { controller, submitRating } = buildController();
    await controller.submitRatingEndpoint({ bookingId: 'b-1', score: 5 } as never);
    expect(submitRating.execute).toHaveBeenCalled();
  });

  it('listRatingsEndpoint — passes query', async () => {
    const { controller, listRatings } = buildController();
    await controller.listRatingsEndpoint({} as never);
    expect(listRatings.execute).toHaveBeenCalled();
  });

  it('getOrgSettingsEndpoint — calls with no args', async () => {
    const { controller, getOrgSettings } = buildController();
    await controller.getOrgSettingsEndpoint();
    expect(getOrgSettings.execute).toHaveBeenCalledWith();
  });

  it('upsertOrgSettingsEndpoint — passes body', async () => {
    const { controller, upsertOrgSettings } = buildController();
    await controller.upsertOrgSettingsEndpoint({ companyNameAr: 'Company' } as never);
    expect(upsertOrgSettings.execute).toHaveBeenCalledWith(expect.objectContaining({ companyNameAr: 'Company' }));
  });
});