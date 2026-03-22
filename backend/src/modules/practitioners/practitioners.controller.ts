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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { PractitionersService } from './practitioners.service.js';
import { CreatePractitionerDto } from './dto/create-practitioner.dto.js';
import { UpdatePractitionerDto } from './dto/update-practitioner.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { CreateVacationDto } from './dto/create-vacation.dto.js';

@Controller('practitioners')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PractitionersController {
  constructor(private readonly practitionersService: PractitionersService) {}

  @Get()
  @Public()
  async findAll(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('search') search?: string,
    @Query('specialtyId') specialtyId?: string,
    @Query('minRating') minRating?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.practitionersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      search,
      specialtyId,
      minRating: minRating ? parseFloat(minRating) : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return this.practitionersService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  async create(@Body() dto: CreatePractitionerDto) {
    return this.practitionersService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePractitionerDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'practitioners', action: 'delete' })
  async delete(@Param('id') id: string) {
    await this.practitionersService.delete(id);
    return { success: true };
  }

  // --- Availability ---

  @Get(':id/availability')
  @Public()
  async getAvailability(@Param('id') id: string) {
    const schedule = await this.practitionersService.getAvailability(id);
    return { schedule };
  }

  @Put(':id/availability')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async setAvailability(
    @Param('id') id: string,
    @Body() dto: SetAvailabilityDto,
    @CurrentUser() user: { id: string },
  ) {
    const schedule = await this.practitionersService.setAvailability(id, dto, user.id);
    return { success: true, data: { schedule }, message: 'Availability updated' };
  }

  @Get(':id/slots')
  @Public()
  async getSlots(
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('duration') duration?: string,
  ) {
    if (!date) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'date query parameter is required',
        error: 'VALIDATION_ERROR',
      });
    }
    return this.practitionersService.getSlots(
      id,
      date,
      duration ? parseInt(duration, 10) : 30,
    );
  }

  // --- Vacations ---

  @Get(':id/vacations')
  @CheckPermissions({ module: 'practitioners', action: 'view' })
  async getVacations(@Param('id') id: string) {
    return this.practitionersService.getVacations(id);
  }

  @Post(':id/vacations')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async createVacation(
    @Param('id') id: string,
    @Body() dto: CreateVacationDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.practitionersService.createVacation(id, dto, user.id);
  }

  @Delete(':id/vacations/:vacationId')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async deleteVacation(
    @Param('id') id: string,
    @Param('vacationId') vacationId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.practitionersService.deleteVacation(id, vacationId, user.id);
    return { success: true };
  }

  // --- Ratings ---

  @Get(':id/ratings')
  @Public()
  async getRatings(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.practitionersService.getRatings(id, {
      page: page ? parseInt(page, 10) : undefined,
      perPage: perPage ? parseInt(perPage, 10) : undefined,
    });
  }
}
