import { DashboardPeopleController } from './people.controller';

const TENANT = 'tenant-1';
const fn = <T = unknown>(val: T = {} as T) => ({ execute: jest.fn().mockResolvedValue(val) });

function buildController() {
  const createClient = fn({ id: 'c-1' });
  const updateClient = fn({ id: 'c-1' });
  const listClients = fn({ data: [], meta: {} });
  const getClient = fn({ id: 'c-1' });
  const deleteClient = fn();
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
  const assignEmployeeService = fn({ id: 'es-1' });
  const removeEmployeeService = fn();
  const listEmployeeExceptions = fn([]);
  const createEmployeeException = fn({ id: 'ex-1' });
  const deleteEmployeeException = fn();
  const listEmployeeRatings = fn([]);
  const employeeStats = fn({});
  const controller = new DashboardPeopleController(
    createClient as never, updateClient as never, listClients as never, getClient as never,
    deleteClient as never,
    createEmployee as never, listEmployees as never, getEmployee as never,
    updateAvailability as never, employeeOnboarding as never,
    onboardEmployee as never, getAvailability as never, updateEmployee as never,
    deleteEmployee as never, listEmployeeServices as never, assignEmployeeService as never,
    removeEmployeeService as never, listEmployeeExceptions as never, createEmployeeException as never,
    deleteEmployeeException as never, listEmployeeRatings as never,
    employeeStats as never,
  );
  return { controller, createClient, updateClient, listClients, getClient, createEmployee, listEmployees, getEmployee, updateAvailability, employeeOnboarding };
}

describe('DashboardPeopleController', () => {
  it('createClientEndpoint — passes tenantId', async () => {
    const { controller, createClient } = buildController();
    await controller.createClientEndpoint(TENANT, { nameAr: 'أحمد', phone: '+966500000000' } as never);
    expect(createClient.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listClientsEndpoint — passes tenantId and defaults page/limit', async () => {
    const { controller, listClients } = buildController();
    await controller.listClientsEndpoint(TENANT, {} as never);
    expect(listClients.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1, limit: 20 }),
    );
  });

  it('getClientEndpoint — passes tenantId and id', async () => {
    const { controller, getClient } = buildController();
    await controller.getClientEndpoint(TENANT, 'c-1');
    expect(getClient.execute).toHaveBeenCalledWith({ tenantId: TENANT, clientId: 'c-1' });
  });

  it('updateClientEndpoint — passes tenantId and id', async () => {
    const { controller, updateClient } = buildController();
    await controller.updateClientEndpoint(TENANT, 'c-1', { nameAr: 'محمد' } as never);
    expect(updateClient.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, clientId: 'c-1' }),
    );
  });

  it('createEmployeeEndpoint — passes tenantId', async () => {
    const { controller, createEmployee } = buildController();
    await controller.createEmployeeEndpoint(TENANT, { nameAr: 'سارة' } as never);
    expect(createEmployee.execute).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT }));
  });

  it('listEmployeesEndpoint — passes tenantId and defaults pagination', async () => {
    const { controller, listEmployees } = buildController();
    await controller.listEmployeesEndpoint(TENANT, {} as never);
    expect(listEmployees.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, page: 1, limit: 20 }),
    );
  });

  it('getEmployeeEndpoint — passes tenantId and id', async () => {
    const { controller, getEmployee } = buildController();
    await controller.getEmployeeEndpoint(TENANT, 'e-1');
    expect(getEmployee.execute).toHaveBeenCalledWith({ tenantId: TENANT, employeeId: 'e-1' });
  });

  it('updateAvailabilityEndpoint — passes tenantId and employeeId', async () => {
    const { controller, updateAvailability } = buildController();
    await controller.updateAvailabilityEndpoint(TENANT, 'e-1', { windows: [], exceptions: [] } as never);
    expect(updateAvailability.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, employeeId: 'e-1' }),
    );
  });

  it('employeeOnboardingEndpoint — passes tenantId and employeeId', async () => {
    const { controller, employeeOnboarding } = buildController();
    await controller.employeeOnboardingEndpoint(TENANT, 'e-1', {} as never);
    expect(employeeOnboarding.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, employeeId: 'e-1' }),
    );
  });
});