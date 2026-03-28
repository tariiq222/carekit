import {
  BadRequestException,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { OnboardPractitionerDto } from './dto/onboard-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';
import { AssignPractitionerServiceDto } from './dto/assign-practitioner-service.dto.js';
import { UpdatePractitionerServiceDto } from './dto/update-practitioner-service.dto.js';
import { SetBreaksDto } from './dto/set-breaks.dto.js';
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
  async findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('search') search?: string,
    @Query('specialty') specialty?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('minRating') minRating?: string,
    @Query('isActive') isActive?: string,
    @Query('branchId') branchId?: string,
  ) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (branchId && !UUID_RE.test(branchId)) {
      throw new BadRequestException('branchId must be a valid UUID');
    }

    return this.practitionersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      search,
      specialty,
      specialtyId,
      minRating: minRating ? parseFloat(minRating) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      branchId,
    });
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.practitionersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  async create(@Body() dto: CreatePractitionerDto) {
    return this.practitionersService.create(dto);
  }

  @Post('onboard')
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  async onboard(@Body() dto: OnboardPractitionerDto) {
    return this.onboardingService.onboard(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdatePractitionerDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'practitioners', action: 'delete' })
  async delete(@Param('id', uuidPipe) id: string) {
    await this.practitionersService.delete(id);
    return { success: true };
  }

  // --- Availability ---

  @Get(':id/availability')
  @Public()
  async getAvailability(@Param('id', uuidPipe) id: string) {
    const schedule = await this.availabilityService.getAvailability(id);
    return { schedule };
  }

  @Put(':id/availability')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async setAvailability(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: { id: string },
  ) {
    const schedule = await this.availabilityService.setAvailability(id, dto, user.id);
    return { success: true, data: { schedule }, message: 'Availability updated' };
  }

  @Get(':id/slots')
  @Public()
  async getSlots(
    @Param('id', uuidPipe) id: string,
    @Query('date') date?: string,
    @Query('duration') duration?: string,
    @Query('bookingType') bookingType?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'date query parameter is required',
        error: 'VALIDATION_ERROR',
      });
    }
    let resolvedDuration = duration ? parseInt(duration, 10) : 30;

    // If bookingType and serviceId provided, resolve duration from pricing models
    const VALID_BOOKING_TYPES = ['in_person', 'online'];
    if (bookingType && !VALID_BOOKING_TYPES.includes(bookingType)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `bookingType must be one of: ${VALID_BOOKING_TYPES.join(', ')}`,
        error: 'VALIDATION_ERROR',
      });
    }
    if (bookingType && serviceId && !duration) {
      resolvedDuration = await this.practitionersService.resolveDurationForSlots(serviceId, bookingType);
    }

    if (resolvedDuration < 5 || resolvedDuration > 240) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'duration must be between 5 and 240 minutes',
        error: 'VALIDATION_ERROR',
      });
    }
    return this.availabilityService.getSlots(id, date, resolvedDuration);
  }

  // --- Breaks ---

  @Get(':id/breaks')
  @CheckPermissions({ module: 'practitioners', action: 'view' })
  async getBreaks(@Param('id', uuidPipe) id: string) {
    const data = await this.breaksService.getBreaks(id);
    return { success: true, data };
  }

  @Put(':id/breaks')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
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
  async getVacations(@Param('id', uuidPipe) id: string) {
    return this.vacationService.getVacations(id);
  }

  @Post(':id/vacations')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async createVacation(
    @Param('id', uuidPipe) id: string,
    @Body() dto: CreateVacationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.vacationService.createVacation(id, dto, user.id);
  }

  @Delete(':id/vacations/:vacationId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
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
  async listServices(@Param('id', uuidPipe) id: string) {
    return this.practitionerServiceService.listServices(id);
  }

  @Post(':id/services')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async assignService(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPractitionerServiceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.assignService(id, dto, user.id);
  }

  @Patch(':id/services/:serviceId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async updateService(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
    @Body() dto: UpdatePractitionerServiceDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.updateService(id, serviceId, dto, user.id);
  }

  @Delete(':id/services/:serviceId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async removeService(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionerServiceService.removeService(id, serviceId, user.id);
  }

  @Get(':id/services/:serviceId/types')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async getServiceTypes(
    @Param('id', uuidPipe) id: string,
    @Param('serviceId', uuidPipe) serviceId: string,
  ) {
    const data = await this.practitionerServiceService.getServiceTypes(id, serviceId);
    return { success: true, data };
  }

  // --- Ratings ---

  @Get(':id/ratings')
  @Public()
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
