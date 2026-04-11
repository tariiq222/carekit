import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { PractitionersService } from './practitioners.service.js';
import { PractitionerOnboardingService } from './practitioner-onboarding.service.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';
import { PractitionerBreaksService } from './practitioner-breaks.service.js';
import { PractitionerServiceService } from './practitioner-service.service.js';
import { PractitionerRatingsService } from './practitioner-ratings.service.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { OnboardPractitionerDto } from './dto/onboard-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';
import { AssignPractitionerServiceDto } from './dto/assign-practitioner-service.dto.js';
import { UpdatePractitionerServiceDto } from './dto/update-practitioner-service.dto.js';
import { SetBreaksDto } from './dto/set-breaks.dto.js';
import { GetPractitionersQueryDto } from './dto/get-practitioners-query.dto.js';
import { GetSlotsQueryDto } from './dto/get-slots-query.dto.js';
import { GetAvailableDatesQueryDto } from './dto/get-available-dates-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Practitioners')
@ApiBearerAuth()
@Controller('practitioners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PractitionersController {
  constructor(
    private readonly practitionersService: PractitionersService,
    private readonly onboardingService: PractitionerOnboardingService,
    private readonly availabilityService: PractitionerAvailabilityService,
    private readonly vacationService: PractitionerVacationService,
    private readonly breaksService: PractitionerBreaksService,
    private readonly practitionerServiceService: PractitionerServiceService,
    private readonly ratingsService: PractitionerRatingsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all practitioners' })
  @ApiResponse({ status: 200, description: 'Practitioners list returned' })
  async findAll(@Query() query: GetPractitionersQueryDto) {
    return this.practitionersService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a practitioner by ID' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Practitioner returned' })
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.practitionersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  @ApiOperation({ summary: 'Create a new practitioner' })
  @ApiResponse({ status: 201, description: 'Practitioner created' })
  @ApiStandardResponses()
  async create(@Body() dto: CreatePractitionerDto) {
    return this.practitionersService.create(dto);
  }

  @Post('onboard')
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  @ApiOperation({ summary: 'Onboard a practitioner with full profile setup' })
  @ApiResponse({ status: 201, description: 'Practitioner onboarded' })
  @ApiStandardResponses()
  async onboard(@Body() dto: OnboardPractitionerDto) {
    return this.onboardingService.onboard(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Update a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Practitioner updated' })
  @ApiStandardResponses()
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdatePractitionerDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'practitioners', action: 'delete' })
  @ApiOperation({ summary: 'Delete a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Practitioner deleted' })
  @ApiStandardResponses()
  async delete(@Param('id', uuidPipe) id: string) {
    await this.practitionersService.delete(id);
    return { success: true };
  }

  // --- Availability ---

  @Get(':id/availability')
  @Public()
  @ApiOperation({ summary: 'Get practitioner availability schedule' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Availability schedule returned' })
  async getAvailability(@Param('id', uuidPipe) id: string) {
    const schedule = await this.availabilityService.getAvailability(id);
    return { schedule };
  }

  @Put(':id/availability')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Set practitioner availability schedule' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Availability updated' })
  @ApiStandardResponses()
  async setAvailability(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: { id: string },
  ) {
    const schedule = await this.availabilityService.setAvailability(
      id,
      dto,
      user.id,
    );
    return {
      success: true,
      data: { schedule },
      message: 'Availability updated',
    };
  }

  @Get(':id/slots')
  @Public()
  @ApiOperation({ summary: 'Get available booking slots for a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Available slots returned' })
  async getSlots(
    @Param('id', uuidPipe) id: string,
    @Query() query: GetSlotsQueryDto,
  ) {
    let resolvedDuration = query.duration ?? 30;

    // Resolve duration via full pricing chain (practitioner options → service options → type fallback)
    // when bookingType + serviceId are provided and no explicit duration override given.
    if (query.bookingType && query.serviceId && !query.duration) {
      resolvedDuration =
        await this.practitionersService.resolveDurationForSlots(
          query.serviceId,
          query.bookingType,
          id,
        );
    }

    return this.availabilityService.getSlots(
      id,
      query.date,
      resolvedDuration,
      query.branchId,
    );
  }

  @Get(':id/available-dates')
  @Public()
  @ApiOperation({ summary: 'Get available dates for a practitioner in a month' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Available dates returned' })
  async getAvailableDates(
    @Param('id', uuidPipe) id: string,
    @Query() query: GetAvailableDatesQueryDto,
  ) {
    let resolvedDuration = query.duration ?? 30;

    // Resolve duration via full pricing chain when bookingType + serviceId provided
    if (query.bookingType && query.serviceId && !query.duration) {
      resolvedDuration =
        await this.practitionersService.resolveDurationForSlots(
          query.serviceId,
          query.bookingType,
          id,
        );
    }

    const result = await this.availabilityService.getAvailableDates(
      id,
      query.month,
      resolvedDuration,
      query.branchId,
    );
    return { success: true, data: result };
  }

  // --- Breaks ---

  @Get(':id/breaks')
  @CheckPermissions({ module: 'practitioners', action: 'view' })
  @ApiOperation({ summary: 'Get practitioner daily breaks' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Breaks returned' })
  @ApiStandardResponses()
  async getBreaks(@Param('id', uuidPipe) id: string) {
    const data = await this.breaksService.getBreaks(id);
    return { success: true, data };
  }

  @Put(':id/breaks')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Set practitioner daily breaks' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Breaks updated' })
  @ApiStandardResponses()
  async setBreaks(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetBreaksDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.breaksService.setBreaks(id, dto, user.id);
    return { success: true, data, message: 'Breaks updated' };
  }

  // --- Vacations ---

  @Get(':id/vacations')
  @CheckPermissions({ module: 'practitioners', action: 'view' })
  @ApiOperation({ summary: 'List practitioner vacations' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Vacations returned' })
  @ApiStandardResponses()
  async getVacations(@Param('id', uuidPipe) id: string) {
    return this.vacationService.getVacations(id);
  }

  @Post(':id/vacations')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Create a vacation period for a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 201, description: 'Vacation created' })
  @ApiStandardResponses()
  async createVacation(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CreateVacationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.vacationService.createVacation(id, dto, user.id);
  }

  @Delete(':id/vacations/:vacationId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Delete a practitioner vacation' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiParam({ name: 'vacationId', description: 'Vacation UUID' })
  @ApiResponse({ status: 200, description: 'Vacation deleted' })
  @ApiStandardResponses()
  async deleteVacation(
    @Param('id', uuidPipe) id: string,
    @Param('vacationId', uuidPipe) vacationId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.vacationService.deleteVacation(id, vacationId, user.id);
    return { success: true };
  }

  // --- Practitioner Services (pricing) ---

  @Get(':id/services')
  @Public()
  @ApiOperation({ summary: 'List services offered by a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Services returned' })
  async listServices(@Param('id', uuidPipe) id: string) {
    return this.practitionerServiceService.listServices(id);
  }

  @Post(':id/services')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Assign a service to a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiResponse({ status: 201, description: 'Service assigned' })
  @ApiStandardResponses()
  async assignService(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPractitionerServiceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.assignService(id, dto, user.id);
  }

  @Patch(':id/services/:serviceId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Update a practitioner service pricing' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiStandardResponses()
  async updateService(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
    @Body() dto: UpdatePractitionerServiceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.updateService(
      id,
      serviceId,
      dto,
      user.id,
    );
  }

  @Delete(':id/services/:serviceId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Remove a service from a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service removed' })
  @ApiStandardResponses()
  async removeService(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.removeService(
      id,
      serviceId,
      user.id,
    );
  }

  @Get(':id/services/:serviceId/types')
  @Public()
  @ApiOperation({ summary: 'Get booking types for a practitioner service' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiResponse({ status: 200, description: 'Service types returned' })
  async getServiceTypes(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
  ) {
    const data = await this.practitionerServiceService.getServiceTypes(
      id,
      serviceId,
    );
    return { success: true, data };
  }

  // --- Ratings ---

  @Get(':id/ratings')
  @Public()
  @ApiOperation({ summary: 'Get ratings for a practitioner' })
  @ApiParam({ name: 'id', description: 'Practitioner UUID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'perPage', required: false, description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Ratings returned' })
  async getRatings(
    @Param('id', uuidPipe) id: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.ratingsService.getRatings(id, {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }
}
