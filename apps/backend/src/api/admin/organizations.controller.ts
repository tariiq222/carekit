import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  AdminHostGuard,
  JwtGuard,
  SuperAdminGuard,
} from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ListOrganizationsHandler } from '../../modules/platform/admin/list-organizations/list-organizations.handler';
import { GetOrganizationHandler } from '../../modules/platform/admin/get-organization/get-organization.handler';
import { SuspendOrganizationHandler } from '../../modules/platform/admin/suspend-organization/suspend-organization.handler';
import { ReinstateOrganizationHandler } from '../../modules/platform/admin/reinstate-organization/reinstate-organization.handler';
import {
  ReinstateOrganizationDto,
  SuspendOrganizationDto,
} from './dto/suspend-organization.dto';

// Guard order is load-bearing:
//   1. AdminHostGuard — rejects non-admin Host headers (invariant 2)
//   2. JwtGuard       — validates JWT + rejects ORG_SUSPENDED (invariant 3)
//   3. SuperAdminGuard — re-verifies isSuperAdmin against DB (invariants 1 + 4)
// SuperAdminContextInterceptor runs after guards and unlocks $allTenants
// by setting the CLS flag (invariant 1). It also refuses to run when the
// token carries scope='impersonation'.
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/organizations')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminOrganizationsController {
  constructor(
    private readonly listHandler: ListOrganizationsHandler,
    private readonly getHandler: GetOrganizationHandler,
    private readonly suspendHandler: SuspendOrganizationHandler,
    private readonly reinstateHandler: ReinstateOrganizationHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all organizations (cross-tenant)' })
  list(
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
    @Query('search') search?: string,
    @Query('suspended') suspended?: string,
  ) {
    const parsedSuspended =
      suspended === 'true' ? true : suspended === 'false' ? false : undefined;
    return this.listHandler.execute({
      page: Math.max(1, Number(page ?? 1)),
      perPage: Math.min(Math.max(1, Number(perPage ?? 20)), 100),
      search: search?.trim() ? search.trim() : undefined,
      suspended: parsedSuspended,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization detail with stats' })
  show(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.getHandler.execute({ id });
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suspend an organization (logs audit entry)' })
  async suspend(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SuspendOrganizationDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.suspendHandler.execute({
      organizationId: id,
      superAdminUserId: user.sub,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }

  @Post(':id/reinstate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reinstate a suspended organization' })
  async reinstate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReinstateOrganizationDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.reinstateHandler.execute({
      organizationId: id,
      superAdminUserId: user.sub,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
