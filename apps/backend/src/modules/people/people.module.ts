import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { CreateClientHandler } from './clients/create-client.handler';
import { UpdateClientHandler } from './clients/update-client.handler';
import { ListClientsHandler } from './clients/list-clients.handler';
import { GetClientHandler } from './clients/get-client.handler';
import { CreateEmployeeHandler } from './employees/create-employee.handler';
import { UpdateAvailabilityHandler } from './employees/update-availability.handler';
import { EmployeeOnboardingHandler } from './employees/employee-onboarding.handler';
import { ListEmployeesHandler } from './employees/list-employees.handler';
import { GetEmployeeHandler } from './employees/get-employee.handler';

const handlers = [
  CreateClientHandler, UpdateClientHandler, ListClientsHandler, GetClientHandler,
  CreateEmployeeHandler, UpdateAvailabilityHandler, EmployeeOnboardingHandler,
  ListEmployeesHandler, GetEmployeeHandler,
];

@Module({
  imports: [DatabaseModule],
  providers: [...handlers],
  exports: [...handlers],
})
export class PeopleModule {}
