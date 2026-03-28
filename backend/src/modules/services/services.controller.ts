import {
  Body,
  Controller,
  Delete,
  Get,
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
import { Public } from '../../common/decorators/public.decorator.js';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ServicesService } from './services.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';
import { ServicePractitionersService } from './service-practitioners.service.js';
import { IntakeFormsService } from '../intake-forms/intake-forms.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { SetDurationOptionsDto } from './dto/set-duration-options.dto.js';
import { SetServiceBookingTypesDto } from './dto/set-booking-types.dto.js';
import { ServiceListQueryDto } from './dto/service-list-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly durationOptionsService: DurationOptionsService,
    private readonly bookingTypeService: ServiceBookingTypeService,
    private readonly practitionersService: ServicePractitionersService,
    private readonly intakeFormsService: IntakeFormsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  @Get('categories')
  @Public()
  async findAllCategories() {
    return this.servicesService.findAllCategories();
  }

  @Post('categories')
  @CheckPermissions({ module: 'services', action: 'create' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.servicesService.createCategory(dto);
  }

  @Patch('categories/:id')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async updateCategory(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.servicesService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @CheckPermissions({ module: 'services', action: 'delete' })
  async deleteCategory(@Param('id', uuidPipe) id: string) {
    return this.servicesService.deleteCategory(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @Public()
  async findAll(@Query() query: ServiceListQueryDto) {
    return this.servicesService.findAll(query);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'services', action: 'create' })
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'services', action: 'delete' })
  async softDelete(@Param('id', uuidPipe) id: string) {
    return this.servicesService.softDelete(id);
  }

  @Get(':id/intake-forms/all')
  @Public()
  async getIntakeForms(@Param('id', uuidPipe) id: string) {
    return this.intakeFormsService.listForms({ serviceId: id });
  }

  // ═══════════════════════════════════════════════════════════════
  //  DURATION OPTIONS
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/duration-options')
  @Public()
  async getDurationOptions(@Param('id', uuidPipe) id: string) {
    return this.durationOptionsService.getDurationOptions(id);
  }

  @Put(':id/duration-options')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async setDurationOptions(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetDurationOptionsDto,
  ) {
    return this.durationOptionsService.setDurationOptions(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRACTITIONERS
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/practitioners')
  @Public()
  async getPractitioners(@Param('id', uuidPipe) id: string) {
    return this.practitionersService.getPractitionersForService(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING TYPES
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/booking-types')
  @Public()
  async getBookingTypes(@Param('id', uuidPipe) id: string) {
    return this.bookingTypeService.getByService(id);
  }

  @Put(':id/booking-types')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async setBookingTypes(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetServiceBookingTypesDto,
  ) {
    return this.bookingTypeService.setBookingTypes(id, dto);
  }
}
