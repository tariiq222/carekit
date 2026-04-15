import SuperTest from 'supertest';
import { createTestApp, closeTestApp } from '../../../setup/app.setup';
import { testPrisma, cleanTables } from '../../../setup/db.setup';
import {
  seedClient,
  seedEmployee,
  seedService,
  seedBranch,
  seedEmployeeService,
} from '../../../setup/seed.helper';
import {
  createTestToken,
  adminUser,
  TEST_TENANT_ID,
  ensureTestUsers,
} from '../../../setup/auth.helper';

export const FLOW_TENANT = TEST_TENANT_ID;

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
    seedClient(testPrisma as never, FLOW_TENANT),
    seedEmployee(testPrisma as never, FLOW_TENANT),
    seedService(testPrisma as never, FLOW_TENANT),
    seedBranch(testPrisma as never, FLOW_TENANT),
  ]);

  await seedEmployeeService(testPrisma as never, FLOW_TENANT, employee.id, service.id);

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
    'x-tenant-id': FLOW_TENANT,
    Authorization: `Bearer ${token}`,
  };
}
