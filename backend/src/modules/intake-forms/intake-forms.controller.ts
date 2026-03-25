import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { IntakeFormsService } from './intake-forms.service.js';
import { CreateIntakeFormDto } from './dto/create-intake-form.dto.js';
import { UpdateIntakeFormDto } from './dto/update-intake-form.dto.js';
import { SetFieldsDto } from './dto/set-fields.dto.js';
import { SubmitResponseDto } from './dto/submit-response.dto.js';

@ApiTags('Intake Forms')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IntakeFormsController {
  constructor(private readonly intakeFormsService: IntakeFormsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  FORMS — under /services/:serviceId/intake-forms
  // ═══════════════════════════════════════════════════════════════

  @Get('services/:serviceId/intake-forms')
  @Public()
  async getFormsByService(
    @Param('serviceId', uuidPipe) serviceId: string,
  ) {
    return this.intakeFormsService.getFormsByService(serviceId);
  }

  @Get('services/:serviceId/intake-forms/all')
  @CheckPermissions({ module: 'services', action: 'view' })
  async getAllFormsByService(
    @Param('serviceId', uuidPipe) serviceId: string,
  ) {
    return this.intakeFormsService.getAllFormsByService(serviceId);
  }

  @Post('services/:serviceId/intake-forms')
  @CheckPermissions({ module: 'services', action: 'create' })
  async createForm(
    @Param('serviceId', uuidPipe) serviceId: string,
    @Body() dto: CreateIntakeFormDto,
  ) {
    return this.intakeFormsService.createForm(serviceId, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  FORM CRUD — under /intake-forms/:formId
  // ═══════════════════════════════════════════════════════════════

  @Patch('intake-forms/:formId')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async updateForm(
    @Param('formId', uuidPipe) formId: string,
    @Body() dto: UpdateIntakeFormDto,
  ) {
    return this.intakeFormsService.updateForm(formId, dto);
  }

  @Delete('intake-forms/:formId')
  @CheckPermissions({ module: 'services', action: 'delete' })
  async deleteForm(@Param('formId', uuidPipe) formId: string) {
    return this.intakeFormsService.deleteForm(formId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIELDS — under /intake-forms/:formId/fields
  // ═══════════════════════════════════════════════════════════════

  @Put('intake-forms/:formId/fields')
  @CheckPermissions({ module: 'services', action: 'edit' })
  async setFields(
    @Param('formId', uuidPipe) formId: string,
    @Body() dto: SetFieldsDto,
  ) {
    return this.intakeFormsService.setFields(formId, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESPONSES
  // ═══════════════════════════════════════════════════════════════

  @Post('intake-forms/:formId/responses')
  async submitResponse(
    @Param('formId', uuidPipe) formId: string,
    @CurrentUser('id') patientId: string,
    @Body() dto: SubmitResponseDto,
  ) {
    dto.formId = formId;
    return this.intakeFormsService.submitResponse(patientId, dto);
  }

  @Get('intake-forms/responses/:bookingId')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async getResponseByBooking(
    @Param('bookingId', uuidPipe) bookingId: string,
  ) {
    return this.intakeFormsService.getResponseByBooking(bookingId);
  }
}
