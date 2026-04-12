import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
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
import { CreateEmployeeDto } from '../../modules/people/employees/create-employee.dto';
import { ListEmployeesDto } from '../../modules/people/employees/list-employees.dto';
import { UpdateAvailabilityDto } from '../../modules/people/employees/update-availability.dto';
import { EmployeeOnboardingDto } from '../../modules/people/employees/employee-onboarding.dto';

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
}
