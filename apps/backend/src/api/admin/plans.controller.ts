import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminHostGuard, JwtGuard, SuperAdminGuard } from '../../common/guards';
import { SuperAdminContextInterceptor } from '../../common/interceptors';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ListPlansAdminHandler } from '../../modules/platform/admin/list-plans/list-plans-admin.handler';
import { CreatePlanHandler } from '../../modules/platform/admin/create-plan/create-plan.handler';
import { UpdatePlanHandler } from '../../modules/platform/admin/update-plan/update-plan.handler';
import { DeletePlanHandler } from '../../modules/platform/admin/delete-plan/delete-plan.handler';
import { CreatePlanDto, UpdatePlanDto, DeletePlanDto } from './dto/plan.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/plans')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminPlansController {
  constructor(
    private readonly listHandler: ListPlansAdminHandler,
    private readonly createHandler: CreatePlanHandler,
    private readonly updateHandler: UpdatePlanHandler,
    private readonly deleteHandler: DeletePlanHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all plans (admin view, includes inactive)' })
  list() {
    return this.listHandler.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Create a plan (audited)' })
  create(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ) {
    const { reason, ...data } = dto;
    return this.createHandler.execute({
      superAdminUserId: user.sub,
      reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
      data,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan (audited)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ) {
    const { reason, ...data } = dto;
    return this.updateHandler.execute({
      planId: id,
      superAdminUserId: user.sub,
      reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
      data,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a plan (sets isActive=false; audited)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeletePlanDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.deleteHandler.execute({
      planId: id,
      superAdminUserId: user.sub,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
