import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { DeleteClientHandler } from '../../modules/people/clients/delete-client.handler';
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
import { GetAvailabilityHandler } from '../../modules/people/employees/get-availability.handler';
import { UpdateEmployeeHandler } from '../../modules/people/employees/update-employee.handler';
import { UpdateEmployeeDto } from '../../modules/people/employees/update-employee.dto';
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
import { EmployeeStatsHandler } from '../../modules/people/employees/employee-stats.handler';
import { UploadAvatarHandler } from '../../modules/people/employees/upload-avatar/upload-avatar.handler';

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
    private readonly deleteClient: DeleteClientHandler,
    private readonly createEmployee: CreateEmployeeHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly getEmployee: GetEmployeeHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
    private readonly employeeOnboarding: EmployeeOnboardingHandler,
    private readonly onboardEmployee: OnboardEmployeeHandler,
    private readonly getAvailability: GetAvailabilityHandler,
    private readonly updateEmployee: UpdateEmployeeHandler,
    private readonly deleteEmployee: DeleteEmployeeHandler,
    private readonly listEmployeeServices: ListEmployeeServicesHandler,
    private readonly assignEmployeeService: AssignEmployeeServiceHandler,
    private readonly removeEmployeeService: RemoveEmployeeServiceHandler,
    private readonly listEmployeeExceptions: ListEmployeeExceptionsHandler,
    private readonly createEmployeeException: CreateEmployeeExceptionHandler,
    private readonly deleteEmployeeException: DeleteEmployeeExceptionHandler,
    private readonly listEmployeeRatings: ListEmployeeRatingsHandler,
    private readonly employeeStats: EmployeeStatsHandler,
    private readonly uploadAvatar: UploadAvatarHandler,
  ) {}
  // ── Clients ────────────────────────────────────────────────────────────────
  @Post('clients')
  @HttpCode(HttpStatus.CREATED)
  createClientEndpoint(@Body() body: CreateClientDto) {
    return this.createClient.execute(body);
  }

  @Get('clients')
  listClientsEndpoint(
    @Query() query: ListClientsDto,
    @Query('isActive') rawIsActive?: string,
  ) {
    // Global ValidationPipe has enableImplicitConversion: true, which runs
    // Boolean(string) against query params — making any non-empty string truthy
    // (so "false" becomes true). Parse the raw value explicitly instead.
    const isActive =
      rawIsActive === 'true' ? true : rawIsActive === 'false' ? false : undefined;
    return this.listClients.execute({
      ...query,
      isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('clients/:id')
  getClientEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getClient.execute({ clientId: id });
  }

  @Patch('clients/:id')
  updateClientEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientDto,
  ) {
    return this.updateClient.execute({ clientId: id, ...body });
  }

  @Delete('clients/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteClientEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    await this.deleteClient.execute({ clientId: id });
  }
  // ── Employees ──────────────────────────────────────────────────────────────
  @Post('employees')
  @HttpCode(HttpStatus.CREATED)
  createEmployeeEndpoint(@Body() body: CreateEmployeeDto) {
    return this.createEmployee.execute(body);
  }

  @Post('employees/onboarding')
  @HttpCode(HttpStatus.CREATED)
  onboardEmployeeEndpoint(@Body() body: OnboardEmployeeDto) {
    return this.onboardEmployee.execute(body);
  }

  @Get('employees')
  listEmployeesEndpoint(
    @Query() query: ListEmployeesDto,
    @Query('isActive') rawIsActive?: string,
  ) {
    // Global ValidationPipe has enableImplicitConversion: true, which runs
    // Boolean(string) against query params — making any non-empty string truthy
    // (so "false" becomes true). Parse the raw value explicitly instead.
    const isActive =
      rawIsActive === 'true' ? true : rawIsActive === 'false' ? false : undefined;
    return this.listEmployees.execute({
      ...query,
      isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('employees/stats')
  employeeStatsEndpoint() {
    return this.employeeStats.execute();
  }

  @Get('employees/:id')
  getEmployeeEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getEmployee.execute({ employeeId: id });
  }

  @Patch('employees/:id')
  updateEmployeeEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmployeeDto,
  ) {
    return this.updateEmployee.execute({ employeeId: id, ...body });
  }

  @Get('employees/:id/availability')
  getAvailabilityEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getAvailability.execute({ employeeId: id });
  }

  @Get('employees/:id/breaks')
  getBreaksEndpoint(@Param('id', ParseUUIDPipe) _id: string) {
    return [];
  }

  @Put('employees/:id/breaks')
  @HttpCode(HttpStatus.OK)
  putBreaksEndpoint(
    @Param('id', ParseUUIDPipe) _id: string,
    @Body() _body: unknown,
  ) {
    // Breaks are stored as gaps in split-shift EmployeeAvailability rows,
    // not as a separate resource. Accept payload but no-op until the
    // schedule-splitting migration lands.
    return [];
  }

  @Get('employees/:id/vacations')
  listVacationsEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/vacations')
  @HttpCode(HttpStatus.CREATED)
  createVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ) {
    return this.createEmployeeException.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id/vacations/:vacationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vacationId', ParseUUIDPipe) vacationId: string,
  ) {
    return this.deleteEmployeeException.execute({ employeeId: id, exceptionId: vacationId });
  }

  @Patch('employees/:id/availability')
  updateAvailabilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAvailabilityDto,
  ) {
    return this.updateAvailability.execute({
      employeeId: id,
      windows: body.windows,
      exceptions: body.exceptions,
    });
  }

  @Post('employees/:id/onboarding')
  @HttpCode(HttpStatus.OK)
  employeeOnboardingEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeOnboardingDto,
  ) {
    return this.employeeOnboarding.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmployeeEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteEmployee.execute({ employeeId: id });
  }

  @Get('employees/:id/services')
  listEmployeeServicesEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeServices.execute({ employeeId: id });
  }

  @Post('employees/:id/services')
  @HttpCode(HttpStatus.CREATED)
  assignEmployeeServiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { serviceId: string },
  ) {
    return this.assignEmployeeService.execute({ employeeId: id, serviceId: body.serviceId });
  }

  @Delete('employees/:id/services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmployeeServiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.removeEmployeeService.execute({ employeeId: id, serviceId });
  }

  @Get('employees/:id/exceptions')
  listEmployeeExceptionsEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/exceptions')
  @HttpCode(HttpStatus.CREATED)
  createEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ) {
    return this.createEmployeeException.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id/exceptions/:exceptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ) {
    return this.deleteEmployeeException.execute({ employeeId: id, exceptionId });
  }

  @Get('employees/:id/ratings')
  listEmployeeRatingsEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeRatings.execute({ employeeId: id });
  }

  @Post('employees/:employeeId/avatar')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatarEndpoint(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.uploadAvatar.execute({
      employeeId,
      filename: file.originalname, mimetype: file.mimetype, size: file.size,
    }, file.buffer);
  }
}
