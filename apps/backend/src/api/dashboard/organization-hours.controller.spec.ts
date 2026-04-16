import { DashboardOrganizationHoursController } from './organization-hours.controller';

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
  it('setBusinessHoursEndpoint — passes body', async () => {
    const { controller, setBusinessHours } = buildController();
    await controller.setBusinessHoursEndpoint({ branchId: 'br-1' } as never);
    expect(setBusinessHours.execute).toHaveBeenCalled();
  });

  it('getBusinessHoursEndpoint — passes branchId', async () => {
    const { controller, getBusinessHours } = buildController();
    await controller.getBusinessHoursEndpoint('br-1');
    expect(getBusinessHours.execute).toHaveBeenCalledWith({ branchId: 'br-1' });
  });

  it('addHolidayEndpoint — passes body', async () => {
    const { controller, addHoliday } = buildController();
    await controller.addHolidayEndpoint({ nameAr: 'عيد' } as never);
    expect(addHoliday.execute).toHaveBeenCalled();
  });

  it('removeHolidayEndpoint — passes holidayId', async () => {
    const { controller, removeHoliday } = buildController();
    await controller.removeHolidayEndpoint('hol-1');
    expect(removeHoliday.execute).toHaveBeenCalledWith({ holidayId: 'hol-1' });
  });

  it('listHolidaysEndpoint — passes query', async () => {
    const { controller, listHolidays } = buildController();
    await controller.listHolidaysEndpoint({} as never);
    expect(listHolidays.execute).toHaveBeenCalled();
  });
});
