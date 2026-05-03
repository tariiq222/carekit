import { DashboardPeopleController } from './people.controller';
import { ENFORCE_LIMIT_KEY } from '../../modules/platform/billing/plan-limits.decorator';

const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createClient = fn({ id: 'c-1' });
  const updateClient = fn({ id: 'c-1' });
  const listClients = fn({ data: [], meta: {} });
  const getClient = fn({ id: 'c-1' });
  const deleteClient = fn();
  const setClientActive = fn({ id: 'c-1' });
  const createEmployee = fn({ id: 'e-1' });
  const listEmployees = fn({ data: [], meta: {} });
  const getEmployee = fn({ id: 'e-1' });
  const updateAvailability = fn({ slots: [] });
  const employeeOnboarding = fn({ id: 'e-1' });
  const onboardEmployee = fn({ id: 'e-1' });
  const getAvailability = fn({ windows: [], exceptions: [] });
  const updateEmployee = fn({ id: 'e-1' });
  const deleteEmployee = fn();
  const listEmployeeServices = fn([]);
  const getEmployeeServiceTypes = fn([]);
  const checkAvailability = fn([]);
  const assignEmployeeService = fn({ id: 'es-1' });
  const removeEmployeeService = fn();
  const listEmployeeExceptions = fn([]);
  const createEmployeeException = fn({ id: 'ex-1' });
  const deleteEmployeeException = fn();
  const listEmployeeRatings = fn([]);
  const employeeStats = fn({});
  const uploadAvatar = fn({ fileId: 'f-1', url: 'https://example.com/avatar.png' });
  const attachMembership = fn({ id: 'membership-1' });
  const getEmployeeBreaks = fn([]);
  const setEmployeeBreaks = fn([]);
  const controller = new DashboardPeopleController(
    createClient as never, updateClient as never, listClients as never, getClient as never,
    deleteClient as never,
    setClientActive as never,
    createEmployee as never, listEmployees as never, getEmployee as never,
    updateAvailability as never, employeeOnboarding as never,
    onboardEmployee as never, getAvailability as never, updateEmployee as never,
    deleteEmployee as never, listEmployeeServices as never, getEmployeeServiceTypes as never, checkAvailability as never, assignEmployeeService as never,
    removeEmployeeService as never, listEmployeeExceptions as never, createEmployeeException as never,
    deleteEmployeeException as never, listEmployeeRatings as never,
    employeeStats as never, uploadAvatar as never, attachMembership as never,
    getEmployeeBreaks as never, setEmployeeBreaks as never,
  );
  return {
    controller,
    createClient,
    updateClient,
    listClients,
    getClient,
    createEmployee,
    listEmployees,
    getEmployee,
    updateAvailability,
    employeeOnboarding,
    listEmployeeRatings,
  };
}

describe('DashboardPeopleController', () => {
  it('createClientEndpoint — passes body', async () => {
    const { controller, createClient } = buildController();
    await controller.createClientEndpoint({ nameAr: 'أحمد', phone: '+966500000000' } as never);
    expect(createClient.execute).toHaveBeenCalled();
  });

  it('listClientsEndpoint — defaults page/limit', async () => {
    const { controller, listClients } = buildController();
    await controller.listClientsEndpoint({} as never);
    expect(listClients.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('getClientEndpoint — passes id', async () => {
    const { controller, getClient } = buildController();
    await controller.getClientEndpoint('c-1');
    expect(getClient.execute).toHaveBeenCalledWith({ clientId: 'c-1' });
  });

  it('updateClientEndpoint — passes id and body', async () => {
    const { controller, updateClient } = buildController();
    await controller.updateClientEndpoint('c-1', { nameAr: 'محمد' } as never);
    expect(updateClient.execute).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'c-1' }),
    );
  });

  it('createEmployeeEndpoint — passes body', async () => {
    const { controller, createEmployee } = buildController();
    await controller.createEmployeeEndpoint({ nameAr: 'سارة' } as never);
    expect(createEmployee.execute).toHaveBeenCalled();
  });

  it('employee create, onboarding create, and attach endpoints enforce employee plan limits', () => {
    expect(
      Reflect.getMetadata(
        ENFORCE_LIMIT_KEY,
        DashboardPeopleController.prototype.createEmployeeEndpoint,
      ),
    ).toBe('EMPLOYEES');
    expect(
      Reflect.getMetadata(
        ENFORCE_LIMIT_KEY,
        DashboardPeopleController.prototype.onboardEmployeeEndpoint,
      ),
    ).toBe('EMPLOYEES');
    expect(
      Reflect.getMetadata(
        ENFORCE_LIMIT_KEY,
        DashboardPeopleController.prototype.attachMembershipEndpoint,
      ),
    ).toBe('EMPLOYEES');
  });

  it('listEmployeesEndpoint — defaults pagination', async () => {
    const { controller, listEmployees } = buildController();
    await controller.listEmployeesEndpoint({} as never);
    expect(listEmployees.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('getEmployeeEndpoint — passes id', async () => {
    const { controller, getEmployee } = buildController();
    await controller.getEmployeeEndpoint('e-1');
    expect(getEmployee.execute).toHaveBeenCalledWith({ employeeId: 'e-1' });
  });

  it('listEmployeeRatingsEndpoint — passes id and pagination', async () => {
    const { controller, listEmployeeRatings } = buildController();
    await controller.listEmployeeRatingsEndpoint('e-1', { page: 2, limit: 5 } as never);
    expect(listEmployeeRatings.execute).toHaveBeenCalledWith({
      employeeId: 'e-1',
      page: 2,
      limit: 5,
    });
  });

  it('updateAvailabilityEndpoint — passes employeeId', async () => {
    const { controller, updateAvailability } = buildController();
    await controller.updateAvailabilityEndpoint('e-1', { windows: [], exceptions: [] } as never);
    expect(updateAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'e-1' }),
    );
  });

  it('employeeOnboardingEndpoint — passes employeeId', async () => {
    const { controller, employeeOnboarding } = buildController();
    await controller.employeeOnboardingEndpoint('e-1', {} as never);
    expect(employeeOnboarding.execute).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'e-1' }),
    );
  });
});
