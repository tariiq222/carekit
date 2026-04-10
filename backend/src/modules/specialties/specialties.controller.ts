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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
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

@ApiTags('specialties')
@ApiBearerAuth()
@Controller('specialties')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all specialties' })
  @ApiResponse({ status: 200, description: 'Specialties list returned' })
  async findAll() {
    return this.specialtiesService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a specialty by ID' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty returned' })
  async findOne(@Param('id', uuidPipe) id: string) {
    return this.specialtiesService.findOne(id);
  }

  @Post()
  @CheckPermissions({ module: 'practitioners', action: 'create' })
  @ApiOperation({ summary: 'Create a new specialty' })
  @ApiResponse({ status: 201, description: 'Specialty created' })
  @ApiStandardResponses()
  async create(@Body() dto: CreateSpecialtyDto) {
    return this.specialtiesService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'practitioners', action: 'edit' })
  @ApiOperation({ summary: 'Update a specialty' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty updated' })
  @ApiStandardResponses()
  async update(@Param('id') id: string, @Body() dto: UpdateSpecialtyDto) {
    return this.specialtiesService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'practitioners', action: 'delete' })
  @ApiOperation({ summary: 'Delete a specialty' })
  @ApiParam({ name: 'id', description: 'Specialty UUID' })
  @ApiResponse({ status: 200, description: 'Specialty deleted' })
  @ApiStandardResponses()
  async delete(@Param('id') id: string) {
    return this.specialtiesService.delete(id);
  }
}
