import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../../setup/app.setup';
import { testPrisma, cleanTables } from '../../../setup/db.setup';
import {
  seedClient,
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
  seedEmployeeAvailability,
} from '../../../setup/seed.helper';
import {
  createTestToken,
  adminUser,
  ensureTestUsers,
} from '../../../setup/auth.helper';

export interface FlowFixtures {
  req: SuperTest.Agent;
  token: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  branchId: string;
}

/**
 * Tables touched by the full cross-feature lifecycle. Order matters for TRUNCATE CASCADE
 * — children first in the list; Postgres still resolves FK relationships via CASCADE.
 */
export const FLOW_TABLES = [
  'ZatcaSubmission',
  'Payment',
  'Invoice',
  'WaitlistEntry',
  'BookingStatusLog',
  'Booking',
  'EmployeeService',
  'Client',
  'Employee',
  'Service',
  'Branch',
];

export async function setupFlowFixtures(): Promise<FlowFixtures> {
  const { request } = await createTestApp();
  await ensureTestUsers();
  const token = createTestToken(adminUser);
  await cleanTables(FLOW_TABLES);

  const [client, employee, service, branch] = await Promise.all([
    seedClient(testPrisma as never),
    seedEmployee(testPrisma as never),
    seedService(testPrisma as never),
    seedBranch(testPrisma as never),
  ]);

  await seedEmployeeService(testPrisma as never, employee.id, service.id);
  await seedEmployeeAvailability(testPrisma as never, employee.id);

  return {
    req: request,
    token,
    clientId: client.id,
    employeeId: employee.id,
    serviceId: service.id,
    branchId: branch.id,
  };
}

export async function teardownFlowFixtures(): Promise<void> {
  await cleanTables(FLOW_TABLES);
  await closeTestApp();
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}
