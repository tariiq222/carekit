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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { RequireFeature } from '../../common/decorators/require-feature.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { IntakeFormsService } from './intake-forms.service.js';
import { CreateIntakeFormDto } from './dto/create-intake-form.dto.js';
import { UpdateIntakeFormDto } from './dto/update-intake-form.dto.js';
import { SetFieldsDto } from './dto/set-fields.dto.js';
import { SubmitResponseDto } from './dto/submit-response.dto.js';
import { ListIntakeFormsDto } from './dto/list-intake-forms.dto.js';

@ApiTags('Intake Forms')
@ApiBearerAuth()
@Controller('intake-forms')
@UseGuards(JwtAuthGuard, PermissionsGuard, FeatureFlagGuard)
@RequireFeature('intake_forms')
export class IntakeFormsController {
  constructor(private readonly intakeFormsService: IntakeFormsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  LIST & GET
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'intake_forms', action: 'view' })
  async listForms(@Query() query: ListIntakeFormsDto) {
    return this.intakeFormsService.listForms(query);
  }

  @Get(':formId')
  @CheckPermissions({ module: 'intake_forms', action: 'view' })
  async getForm(@Param('formId', uuidPipe) formId: string) {
    return this.intakeFormsService.getForm(formId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE / UPDATE / DELETE
  // ═══════════════════════════════════════════════════════════════

  @Post()
  @CheckPermissions({ module: 'intake_forms', action: 'create' })
  async createForm(@Body() dto: CreateIntakeFormDto) {
    return this.intakeFormsService.createForm(dto);
  }

  @Patch(':formId')
  @CheckPermissions({ module: 'intake_forms', action: 'edit' })
  async updateForm(
    @Param('formId', uuidPipe) formId: string,
    @Body() dto: UpdateIntakeFormDto,
  ) {
    return this.intakeFormsService.updateForm(formId, dto);
  }

  @Delete(':formId')
  @CheckPermissions({ module: 'intake_forms', action: 'delete' })
  async deleteForm(@Param('formId', uuidPipe) formId: string) {
    return this.intakeFormsService.deleteForm(formId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIELDS
  // ═══════════════════════════════════════════════════════════════

  @Put(':formId/fields')
  @CheckPermissions({ module: 'intake_forms', action: 'edit' })
  async setFields(
    @Param('formId', uuidPipe) formId: string,
    @Body() dto: SetFieldsDto,
  ) {
    return this.intakeFormsService.setFields(formId, dto);
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESPONSES
  // ═══════════════════════════════════════════════════════════════

  @Post(':formId/responses')
  async submitResponse(
    @Param('formId', uuidPipe) formId: string,
    @CurrentUser('id') patientId: string,
    @Body() dto: SubmitResponseDto,
  ) {
    return this.intakeFormsService.submitResponse(patientId, { ...dto, formId });
  }

  @Get('responses/:bookingId')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  async getResponseByBooking(
    @Param('bookingId', uuidPipe) bookingId: string,
  ) {
    return this.intakeFormsService.getResponseByBooking(bookingId);
  }
}
