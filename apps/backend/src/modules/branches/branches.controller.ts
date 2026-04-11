import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { BranchesService } from './branches.service.js';
import { CreateBranchDto } from './dto/create-branch.dto.js';
import { UpdateBranchDto } from './dto/update-branch.dto.js';
import { BranchFilterDto } from './dto/branch-filter.dto.js';
import { AssignPractitionersDto } from './dto/assign-practitioners.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('multi_branch')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'List all public-facing branches' })
  @ApiResponse({ status: 200, description: 'Public branch list returned' })
  async getPublicBranches() {
    return this.branchesService.getPublicBranches();
  }

  @Get()
  @CheckPermissions({ module: 'branches', action: 'view' })
  @ApiOperation({ summary: 'List all branches with filters' })
  @ApiResponse({ status: 200, description: 'Paginated branch list returned' })
  @ApiStandardResponses()
  async findAll(@Query() query: BranchFilterDto) {
    return this.branchesService.findAll(query);
  }

  @Get(':id')
  @CheckPermissions({ module: 'branches', action: 'view' })
  @ApiOperation({ summary: 'Get a branch by ID' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch returned' })
  @ApiStandardResponses()
  async findById(@Param('id', uuidPipe) id: string) {
    return this.branchesService.findById(id);
  }

  @Post()
  @CheckPermissions({ module: 'branches', action: 'create' })
  @ApiOperation({ summary: 'Create a new branch' })
  @ApiResponse({ status: 201, description: 'Branch created' })
  @ApiStandardResponses()
  async create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @CheckPermissions({ module: 'branches', action: 'edit' })
  @ApiOperation({ summary: 'Update a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch updated' })
  @ApiStandardResponses()
  async update(
    @Param('id', uuidPipe) id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @CheckPermissions({ module: 'branches', action: 'delete' })
  @ApiOperation({ summary: 'Delete a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Branch deleted' })
  @ApiStandardResponses()
  async delete(@Param('id', uuidPipe) id: string) {
    return this.branchesService.delete(id);
  }

  // ── Practitioner assignments ──────────────────────────────────

  @Get(':id/practitioners')
  @CheckPermissions({ module: 'branches', action: 'view' })
  @ApiOperation({ summary: 'List practitioners assigned to a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Practitioner list returned' })
  @ApiStandardResponses()
  async getPractitioners(@Param('id', uuidPipe) id: string) {
    return this.branchesService.getPractitioners(id);
  }

  @Patch(':id/practitioners')
  @CheckPermissions({ module: 'branches', action: 'edit' })
  @ApiOperation({ summary: 'Assign practitioners to a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Practitioners assigned' })
  @ApiStandardResponses()
  async assignPractitioners(
    @Param('id', uuidPipe) id: string,
    @Body() dto: AssignPractitionersDto,
  ) {
    return this.branchesService.assignPractitioners(id, dto.practitionerIds);
  }

  @Delete(':id/practitioners/:practitionerId')
  @CheckPermissions({ module: 'branches', action: 'edit' })
  @ApiOperation({ summary: 'Remove a practitioner from a branch' })
  @ApiParam({ name: 'id', description: 'Branch UUID' })
  @ApiParam({ name: 'practitionerId', description: 'Practitioner UUID' })
  @ApiResponse({ status: 200, description: 'Practitioner removed from branch' })
  @ApiStandardResponses()
  async removePractitioner(
    @Param('id', uuidPipe) id: string,
    @Param('practitionerId', uuidPipe) practitionerId: string,
  ) {
    return this.branchesService.removePractitioner(id, practitionerId);
  }
}
