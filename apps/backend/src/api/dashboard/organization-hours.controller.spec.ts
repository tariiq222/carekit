import { DashboardOrganizationHoursController } from './organization-hours.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const setBusinessHours = fn({ id: 'h-1' });
  const getBusinessHours = fn({ id: 'h-1' });
  const addHoliday = fn({ id: 'hol-1' });
  const removeHoliday = fn({ id: 'hol-1' });
  const listHolidays = fn({ data: [] });
  const controller = new DashboardOrganizationHoursController(
    setBusinessHours as never, getBusinessHours as never, addHoliday as never,
    removeHoliday as never, listHolidays as never,
  );
  return { controller, setBusinessHours, getBusinessHours, addHoliday, removeHoliday, listHolidays };
}

describe('DashboardOrganizationHoursController', () => {
  it('setBusinessHoursEndpoint — passes tenantId', async () => {
    const { controller, setBusinessHours } = buildController();
    await controller.setBusinessHoursEndpoint(TENANT, { branchId: 'br-1' } as never);
    expect(setBusinessHours.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('getBusinessHoursEndpoint — passes tenantId and branchId', async () => {
    const { controller, getBusinessHours } = buildController();
    await controller.getBusinessHoursEndpoint(TENANT, 'br-1');
    expect(getBusinessHours.execute).toHaveBeenCalledWith({ tenantId: TENANT, branchId: 'br-1' });
  });

  it('addHolidayEndpoint — passes tenantId', async () => {
    const { controller, addHoliday } = buildController();
    await controller.addHolidayEndpoint(TENANT, { nameAr: 'عيد' } as never);
    expect(addHoliday.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('removeHolidayEndpoint — passes tenantId and holidayId', async () => {
    const { controller, removeHoliday } = buildController();
    await controller.removeHolidayEndpoint(TENANT, 'hol-1');
    expect(removeHoliday.execute).toHaveBeenCalledWith({ tenantId: TENANT, holidayId: 'hol-1' });
  });

  it('listHolidaysEndpoint — passes tenantId', async () => {
    const { controller, listHolidays } = buildController();
    await controller.listHolidaysEndpoint(TENANT, {} as never);
    expect(listHolidays.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });
});