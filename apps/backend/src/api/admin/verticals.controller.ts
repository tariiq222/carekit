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
import { ListVerticalsAdminHandler } from '../../modules/platform/admin/list-verticals/list-verticals-admin.handler';
import { CreateVerticalAdminHandler } from '../../modules/platform/admin/create-vertical/create-vertical-admin.handler';
import { UpdateVerticalAdminHandler } from '../../modules/platform/admin/update-vertical/update-vertical-admin.handler';
import { DeleteVerticalAdminHandler } from '../../modules/platform/admin/delete-vertical/delete-vertical-admin.handler';
import {
  CreateVerticalDto,
  UpdateVerticalDto,
  DeleteVerticalDto,
} from './dto/vertical.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/verticals')
@UseGuards(AdminHostGuard, JwtGuard, SuperAdminGuard)
@UseInterceptors(SuperAdminContextInterceptor)
export class AdminVerticalsController {
  constructor(
    private readonly listHandler: ListVerticalsAdminHandler,
    private readonly createHandler: CreateVerticalAdminHandler,
    private readonly updateHandler: UpdateVerticalAdminHandler,
    private readonly deleteHandler: DeleteVerticalAdminHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all verticals (admin view, includes inactive)' })
  list() {
    return this.listHandler.execute();
  }

  @Post()
  @ApiOperation({ summary: 'Create a vertical (audited)' })
  create(
    @Body() dto: CreateVerticalDto,
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
  @ApiOperation({ summary: 'Update a vertical (audited)' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateVerticalDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ) {
    const { reason, ...data } = dto;
    return this.updateHandler.execute({
      verticalId: id,
      superAdminUserId: user.sub,
      reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
      data,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a vertical (audited)' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DeleteVerticalDto,
    @CurrentUser() user: { sub: string },
    @Req() req: Request,
  ): Promise<void> {
    await this.deleteHandler.execute({
      verticalId: id,
      superAdminUserId: user.sub,
      reason: dto.reason,
      ipAddress: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });
  }
}
