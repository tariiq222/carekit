import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ClientGender, ClientSource, EmployeeGender, EmploymentType, OnboardingStatus } from '@prisma/client';
import {
  IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, IsArray, ArrayUnique, Min,
  IsEmail, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { TenantId } from '../../common/tenant/tenant.decorator';
import { CreateClientHandler } from '../../modules/people/clients/create-client.handler';
import { UpdateClientHandler } from '../../modules/people/clients/update-client.handler';
import { ListClientsHandler } from '../../modules/people/clients/list-clients.handler';
import { GetClientHandler } from '../../modules/people/clients/get-client.handler';
import { CreateEmployeeHandler } from '../../modules/people/employees/create-employee.handler';
import { ListEmployeesHandler } from '../../modules/people/employees/list-employees.handler';
import { GetEmployeeHandler } from '../../modules/people/employees/get-employee.handler';
import { UpdateAvailabilityHandler, AvailabilityWindow, AvailabilityException } from '../../modules/people/employees/update-availability.handler';
import { EmployeeOnboardingHandler } from '../../modules/people/employees/employee-onboarding.handler';

// ── Client DTOs ──────────────────────────────────────────────────────────────

export class CreateClientBody {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsUUID() userId?: string;
}

export class UpdateClientBody {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string | null;
  @IsOptional() @IsString() avatarUrl?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListClientsQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

// ── Employee DTOs ────────────────────────────────────────────────────────────

export class CreateEmployeeBody {
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) serviceIds?: string[];
}

export class ListEmployeesQuery {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) isActive?: boolean;
  @IsOptional() @IsEnum(EmployeeGender) gender?: EmployeeGender;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(OnboardingStatus) onboardingStatus?: OnboardingStatus;
  @IsOptional() @IsUUID() specialtyId?: string;
  @IsOptional() @IsUUID() branchId?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}

export class UpdateAvailabilityBody {
  @IsArray() windows!: AvailabilityWindow[];
  @IsOptional() @IsArray() exceptions?: AvailabilityException[];
}

export class EmployeeOnboardingBody {
  @IsEnum(['profile', 'specialties', 'branches', 'services', 'complete']) step!: 'profile' | 'specialties' | 'branches' | 'services' | 'complete';
  @IsOptional() profile?: {
    name?: string;
    phone?: string;
    email?: string;
    gender?: EmployeeGender;
    bio?: string;
    avatarUrl?: string;
  };
  @IsOptional() @IsArray() @IsString({ each: true }) specialtyIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) branchIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) serviceIds?: string[];
}

// ── Controller ───────────────────────────────────────────────────────────────

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
  createClientEndpoint(@TenantId() tenantId: string, @Body() body: CreateClientBody) {
    return this.createClient.execute({ tenantId, ...body });
  }

  @Get('clients')
  listClientsEndpoint(@TenantId() tenantId: string, @Query() query: ListClientsQuery) {
    return this.listClients.execute({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
      gender: query.gender,
      source: query.source,
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
    @Body() body: UpdateClientBody,
  ) {
    return this.updateClient.execute({ tenantId, clientId: id, ...body });
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  @Post('employees')
  @HttpCode(HttpStatus.CREATED)
  createEmployeeEndpoint(@TenantId() tenantId: string, @Body() body: CreateEmployeeBody) {
    return this.createEmployee.execute({ tenantId, ...body });
  }

  @Get('employees')
  listEmployeesEndpoint(@TenantId() tenantId: string, @Query() query: ListEmployeesQuery) {
    return this.listEmployees.execute({
      tenantId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      isActive: query.isActive,
      gender: query.gender,
      employmentType: query.employmentType,
      onboardingStatus: query.onboardingStatus,
      specialtyId: query.specialtyId,
      branchId: query.branchId,
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
    @Body() body: UpdateAvailabilityBody,
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
    @Body() body: EmployeeOnboardingBody,
  ) {
    return this.employeeOnboarding.execute({ tenantId, employeeId: id, ...body });
  }
}
