import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { ServicesService } from './services.service.js';
import { ServicesAvatarService } from './services-avatar.service.js';
import { ServiceCategoriesService } from './service-categories.service.js';
import { DurationOptionsService } from './duration-options.service.js';
import { ServiceBookingTypeService } from './service-booking-type.service.js';
import { ServicePractitionersService } from './service-practitioners.service.js';
import { CreateServiceDto } from './dto/create-service.dto.js';
import { UpdateServiceDto } from './dto/update-service.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { SetDurationOptionsDto } from './dto/set-duration-options.dto.js';
import { SetServiceBookingTypesDto } from './dto/set-booking-types.dto.js';
import { SetServiceBranchesDto } from './dto/set-service-branches.dto.js';
import { ServiceListQueryDto } from './dto/service-list-query.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ServicesController {
  constructor(
    private readonly categoriesService: ServiceCategoriesService,
    private readonly servicesService: ServicesService,
    private readonly avatarService: ServicesAvatarService,
    private readonly durationOptionsService: DurationOptionsService,
    private readonly bookingTypeService: ServiceBookingTypeService,
    private readonly practitionersService: ServicePractitionersService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  CATEGORIES
  // ═══════════════════════════════════════════════════════════════

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'List all active service categories' })
  @ApiResponse({ status: 200, description: 'List of service categories' })
  async findAllCategories() {
    return this.categoriesService.findAll();
  }

  @Post('categories')
  @CheckPermissions({ module: 'services', action: 'create' })
  @ApiOperation({ summary: 'Create a new service category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  @ApiStandardResponses()
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch('categories/:id')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({ summary: 'Update an existing service category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiStandardResponses()
  async updateCategory(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @CheckPermissions({ module: 'services', action: 'delete' })
  @ApiOperation({
    summary: 'Delete a service category (blocked if services are assigned)',
  })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiStandardResponses()
  async deleteCategory(@Param('id', uuidPipe) id: string) {
    return this.categoriesService.delete(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  SERVICES
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @Public()
  @ApiOperation({
    summary:
      'List services with optional filters (category, search, active status)',
  })
  @ApiResponse({ status: 200, description: 'List of services' })
  async findAll(@Query() query: ServiceListQueryDto) {
    return this.servicesService.findAll(query);
  }

  @Get('list-stats')
  @CheckPermissions({ module: 'services', action: 'view' })
  @ApiOperation({ summary: 'Get aggregate stats for service list' })
  @ApiResponse({ status: 200, description: 'Service list statistics' })
  @ApiStandardResponses()
  async getListStats() {
    return this.servicesService.getListStats();
  }

  @Get('export')
  @CheckPermissions({ module: 'services', action: 'view' })
  @ApiOperation({ summary: 'Export all services as a CSV file' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiStandardResponses()
  async exportCsv(@Res() res: Response) {
    // CSV generation logic lives in the service (fix #16 — separation of concerns)
    const csvContent = await this.servicesService.exportServicesCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="services.csv"');
    res.send(csvContent);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single service by ID' })
  @ApiResponse({ status: 200, description: 'Service details' })
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'services', action: 'create' })
  @ApiOperation({ summary: 'Create a new service' })
  @ApiResponse({ status: 201, description: 'Service created' })
  @ApiStandardResponses()
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({ summary: 'Update an existing service' })
  @ApiResponse({ status: 200, description: 'Service updated' })
  @ApiStandardResponses()
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Post(':id/avatar')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({
    summary:
      'Upload or replace a service avatar image (jpeg, png, webp; max 5MB)',
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded' })
  @ApiStandardResponses()
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
        ) {
          return cb(
            new BadRequestException('Only jpeg, png, webp allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(
    @Param('id', uuidPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.avatarService.uploadAvatar(id, file);
  }

  @Put(':id/branches')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({ summary: 'Replace all branch assignments for a service' })
  @ApiResponse({ status: 200, description: 'Branch assignments updated' })
  @ApiStandardResponses()
  async setBranches(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetServiceBranchesDto,
  ) {
    await this.servicesService.setBranches(id, dto.branchIds);
    return { updated: true };
  }

  @Delete(':id/branches')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({ summary: 'Remove all branch assignments for a service' })
  @ApiResponse({ status: 200, description: 'Branch assignments cleared' })
  @ApiStandardResponses()
  async clearBranches(@Param('id', uuidPipe) id: string) {
    await this.servicesService.clearBranches(id);
    return { cleared: true };
  }

  @Delete(':id')
  @CheckPermissions({ module: 'services', action: 'delete' })
  @ApiOperation({
    summary: 'Soft-delete a service (sets deletedAt, service becomes hidden)',
  })
  @ApiResponse({ status: 200, description: 'Service soft-deleted' })
  @ApiStandardResponses()
  async softDelete(@Param('id', uuidPipe) id: string) {
    return this.servicesService.softDelete(id);
  }

  @Get(':id/intake-forms/all')
  @Public()
  @ApiOperation({ summary: 'Get all active intake forms for a service' })
  @ApiResponse({ status: 200, description: 'List of intake forms' })
  async getIntakeForms(@Param('id', uuidPipe) id: string) {
    return this.servicesService.getIntakeForms(id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  DURATION OPTIONS
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/duration-options')
  @Public()
  @ApiOperation({
    summary: 'Get all duration options for a service booking type',
  })
  @ApiResponse({ status: 200, description: 'Duration options list' })
  async getDurationOptions(@Param('id', uuidPipe) id: string) {
    return this.durationOptionsService.getDurationOptions(id);
  }

  @Put(':id/duration-options')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({
    summary: 'Replace all duration options for a service booking type',
  })
  @ApiResponse({ status: 200, description: 'Duration options updated' })
  @ApiStandardResponses()
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
  @ApiOperation({
    summary:
      'List practitioners who offer this service, optionally filtered by branch',
  })
  @ApiResponse({ status: 200, description: 'List of practitioners' })
  async getPractitioners(
    @Param('id', uuidPipe) id: string,
    @Query('branchId', new ParseUUIDPipe({ optional: true })) branchId?: string,
  ) {
    return this.practitionersService.getPractitionersForService(id, branchId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  BOOKING TYPES
  // ═══════════════════════════════════════════════════════════════

  @Get(':id/booking-types')
  @Public()
  @ApiOperation({
    summary: 'Get all booking types and their duration options for a service',
  })
  @ApiResponse({ status: 200, description: 'Booking types list' })
  async getBookingTypes(@Param('id', uuidPipe) id: string) {
    return this.bookingTypeService.getByService(id);
  }

  @Put(':id/booking-types')
  @CheckPermissions({ module: 'services', action: 'edit' })
  @ApiOperation({
    summary:
      'Replace all booking types for a service (blocked if active bookings exist)',
  })
  @ApiResponse({ status: 200, description: 'Booking types updated' })
  @ApiStandardResponses()
  async setBookingTypes(
    @Param('id', uuidPipe) id: string,
    @Body() dto: SetServiceBookingTypesDto,
  ) {
    return this.bookingTypeService.setBookingTypes(id, dto);
  }
}
