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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { SpecialtiesService } from './specialties.service.js';
import { CreateSpecialtyDto } from './dto/create-specialty.dto.js';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto.js';

const uuidPipe = new ParseUUIDPipe({
  exceptionFactory: () =>
    new BadRequestException({
      statusCode: 400,
      message: 'Invalid UUID format',
      error: 'VALIDATION_ERROR',
    }),
});

@Controller('specialties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  @Public()
  async findAll() {
    return this.specialtiesService.findAll();
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.specialtiesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  async create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  async update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.specialtiesService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'practitioners', action: 'delete' })
  async delete(@Param('id') id: string) {
    return this.specialtiesService.delete(id);
  }
}
