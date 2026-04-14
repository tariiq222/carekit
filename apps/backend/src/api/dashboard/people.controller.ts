import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { CreateClientDto } from '../../modules/people/clients/create-client.dto';
import { UpdateClientDto } from '../../modules/people/clients/update-client.dto';
import { ListClientsDto } from '../../modules/people/clients/list-clients.dto';
import { CreateEmployeeHandler } from '../../modules/people/employees/create-employee.handler';
import { ListEmployeesHandler } from '../../modules/people/employees/list-employees.handler';
import { GetEmployeeHandler } from '../../modules/people/employees/get-employee.handler';
import { UpdateAvailabilityHandler } from '../../modules/people/employees/update-availability.handler';
import { EmployeeOnboardingHandler } from '../../modules/people/employees/employee-onboarding.handler';
import { OnboardEmployeeHandler } from '../../modules/people/employees/onboard-employee.handler';
import { OnboardEmployeeDto } from '../../modules/people/employees/onboard-employee.dto';
import { CreateEmployeeDto } from '../../modules/people/employees/create-employee.dto';
import { ListEmployeesDto } from '../../modules/people/employees/list-employees.dto';
import { UpdateAvailabilityDto } from '../../modules/people/employees/update-availability.dto';
import { EmployeeOnboardingDto } from '../../modules/people/employees/employee-onboarding.dto';
import { DeleteEmployeeHandler } from '../../modules/people/employees/delete-employee.handler';
import { ListEmployeeServicesHandler } from '../../modules/people/employees/list-employee-services.handler';
import { AssignEmployeeServiceHandler } from '../../modules/people/employees/assign-employee-service.handler';
import { RemoveEmployeeServiceHandler } from '../../modules/people/employees/remove-employee-service.handler';
import { ListEmployeeExceptionsHandler } from '../../modules/people/employees/list-employee-exceptions.handler';
import { CreateEmployeeExceptionHandler } from '../../modules/people/employees/create-employee-exception.handler';
import { CreateEmployeeExceptionDto } from '../../modules/people/employees/create-employee-exception.dto';
import { DeleteEmployeeExceptionHandler } from '../../modules/people/employees/delete-employee-exception.handler';
import { ListEmployeeRatingsHandler } from '../../modules/people/employees/list-employee-ratings.handler';

@ApiTags('People')
@ApiBearerAuth()
@Controller('dashboard/people')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardPeopleController {
  constructor(
    private readonly createClient: CreateClientHandler,
    private readonly updateClient: UpdateClientHandler,
    private readonly listClients: ListClientsHandler,
    private readonly getClient: GetClientHandler,
    private readonly createEmployee: CreateEmployeeHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly getEmployee: GetEmployeeHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
    private readonly employeeOnboarding: EmployeeOnboardingHandler,
    private readonly onboardEmployee: OnboardEmployeeHandler,
    private readonly deleteEmployee: DeleteEmployeeHandler,
    private readonly listEmployeeServices: ListEmployeeServicesHandler,
    private readonly assignEmployeeService: AssignEmployeeServiceHandler,
    private readonly removeEmployeeService: RemoveEmployeeServiceHandler,
    private readonly listEmployeeExceptions: ListEmployeeExceptionsHandler,
    private readonly createEmployeeException: CreateEmployeeExceptionHandler,
    private readonly deleteEmployeeException: DeleteEmployeeExceptionHandler,
    private readonly listEmployeeRatings: ListEmployeeRatingsHandler,
  ) {}

  // ── Clients ────────────────────────────────────────────────────────────────

  @Post('clients')
  @HttpCode(HttpStatus.CREATED)
  createClientEndpoint(@TenantId() tenantId: string, @Body() body: CreateClientDto) {
    return this.createClient.execute({ tenantId, ...body });
  }

  @Get('clients')
  listClientsEndpoint(@TenantId() tenantId: string, @Query() query: ListClientsDto) {
    return this.listClients.execute({
      ...query,
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('clients/:id')
  getClientEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getClient.execute({ tenantId, clientId: id });
  }

  @Patch('clients/:id')
  updateClientEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientDto,
  ) {
    return this.updateClient.execute({ tenantId, clientId: id, ...body });
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  @Post('employees')
  @HttpCode(HttpStatus.CREATED)
  createEmployeeEndpoint(@TenantId() tenantId: string, @Body() body: CreateEmployeeDto) {
    return this.createEmployee.execute({ tenantId, ...body });
  }

  @Post('employees/onboarding')
  @HttpCode(HttpStatus.CREATED)
  onboardEmployeeEndpoint(@TenantId() tenantId: string, @Body() body: OnboardEmployeeDto) {
    return this.onboardEmployee.execute({ tenantId, ...body });
  }

  @Get('employees')
  listEmployeesEndpoint(@TenantId() tenantId: string, @Query() query: ListEmployeesDto) {
    return this.listEmployees.execute({
      ...query,
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('employees/:id')
  getEmployeeEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getEmployee.execute({ tenantId, employeeId: id });
  }

  @Patch('employees/:id/availability')
  updateAvailabilityEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAvailabilityDto,
  ) {
    return this.updateAvailability.execute({
      tenantId,
      employeeId: id,
      windows: body.windows,
      exceptions: body.exceptions,
    });
  }

  @Post('employees/:id/onboarding')
  @HttpCode(HttpStatus.OK)
  employeeOnboardingEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeOnboardingDto,
  ) {
    return this.employeeOnboarding.execute({ tenantId, employeeId: id, ...body });
  }

  @Delete('employees/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmployeeEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteEmployee.execute({ tenantId, employeeId: id });
  }

  @Get('employees/:id/services')
  listEmployeeServicesEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listEmployeeServices.execute({ tenantId, employeeId: id });
  }

  @Post('employees/:id/services')
  @HttpCode(HttpStatus.CREATED)
  assignEmployeeServiceEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { serviceId: string },
  ) {
    return this.assignEmployeeService.execute({ tenantId, employeeId: id, serviceId: body.serviceId });
  }

  @Delete('employees/:id/services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmployeeServiceEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.removeEmployeeService.execute({ tenantId, employeeId: id, serviceId });
  }

  @Get('employees/:id/exceptions')
  listEmployeeExceptionsEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listEmployeeExceptions.execute({ tenantId, employeeId: id });
  }

  @Post('employees/:id/exceptions')
  @HttpCode(HttpStatus.CREATED)
  createEmployeeExceptionEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ) {
    return this.createEmployeeException.execute({ tenantId, employeeId: id, ...body });
  }

  @Delete('employees/:id/exceptions/:exceptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmployeeExceptionEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ) {
    return this.deleteEmployeeException.execute({ tenantId, employeeId: id, exceptionId });
  }

  @Get('employees/:id/ratings')
  listEmployeeRatingsEndpoint(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listEmployeeRatings.execute({ tenantId, employeeId: id });
  }
}
