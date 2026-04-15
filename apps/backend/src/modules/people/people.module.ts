import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { CreateClientHandler } from './clients/create-client.handler';
import { UpdateClientHandler } from './clients/update-client.handler';
import { ListClientsHandler } from './clients/list-clients.handler';
import { GetClientHandler } from './clients/get-client.handler';
import { DeleteClientHandler } from './clients/delete-client.handler';
import { CreateEmployeeHandler } from './employees/create-employee.handler';
import { UpdateAvailabilityHandler } from './employees/update-availability.handler';
import { EmployeeOnboardingHandler } from './employees/employee-onboarding.handler';
import { OnboardEmployeeHandler } from './employees/onboard-employee.handler';
import { GetAvailabilityHandler } from './employees/get-availability.handler';
import { UpdateEmployeeHandler } from './employees/update-employee.handler';
import { ListEmployeesHandler } from './employees/list-employees.handler';
import { GetEmployeeHandler } from './employees/get-employee.handler';
import { DeleteEmployeeHandler } from './employees/delete-employee.handler';
import { ListEmployeeServicesHandler } from './employees/list-employee-services.handler';
import { AssignEmployeeServiceHandler } from './employees/assign-employee-service.handler';
import { RemoveEmployeeServiceHandler } from './employees/remove-employee-service.handler';
import { ListEmployeeExceptionsHandler } from './employees/list-employee-exceptions.handler';
import { CreateEmployeeExceptionHandler } from './employees/create-employee-exception.handler';
import { DeleteEmployeeExceptionHandler } from './employees/delete-employee-exception.handler';
import { ListEmployeeRatingsHandler } from './employees/list-employee-ratings.handler';
import { EmployeeStatsHandler } from './employees/employee-stats.handler';
import { DashboardPeopleController } from '../../api/dashboard/people.controller';

const handlers = [
  CreateClientHandler, UpdateClientHandler, ListClientsHandler, GetClientHandler, DeleteClientHandler,
  CreateEmployeeHandler, UpdateAvailabilityHandler, EmployeeOnboardingHandler, OnboardEmployeeHandler, GetAvailabilityHandler, UpdateEmployeeHandler,
  ListEmployeesHandler, GetEmployeeHandler,
  DeleteEmployeeHandler, ListEmployeeServicesHandler, AssignEmployeeServiceHandler,
  RemoveEmployeeServiceHandler, ListEmployeeExceptionsHandler, CreateEmployeeExceptionHandler,
  DeleteEmployeeExceptionHandler, ListEmployeeRatingsHandler, EmployeeStatsHandler,
];

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardPeopleController],
  providers: [...handlers],
  exports: [...handlers],
})
export class PeopleModule {}
