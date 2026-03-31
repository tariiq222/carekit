import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateIntakeFormDto } from './dto/create-intake-form.dto.js';
import { UpdateIntakeFormDto } from './dto/update-intake-form.dto.js';
import { SetFieldsDto } from './dto/set-fields.dto.js';
import { SubmitResponseDto } from './dto/submit-response.dto.js';
import { ListIntakeFormsDto } from './dto/list-intake-forms.dto.js';

@Injectable()
export class IntakeFormsService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  LIST & GET
  // ═══════════════════════════════════════════════════════════════

  async listForms(query: ListIntakeFormsDto) {
    return this.prisma.intakeForm.findMany({
      where: {
        ...(query.scope && { scope: query.scope }),
        ...(query.type && { type: query.type }),
        ...(query.serviceId && { serviceId: query.serviceId }),
        ...(query.practitionerId && { practitionerId: query.practitionerId }),
        ...(query.branchId && { branchId: query.branchId }),
        ...(query.isActive !== undefined && { isActive: query.isActive }),
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForm(formId: string) {
    const form = await this.prisma.intakeForm.findUnique({
      where: { id: formId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!form) throw this.notFound('Intake form not found');
    return form;
  }

  // ═══════════════════════════════════════════════════════════════
  //  CREATE / UPDATE / DELETE
  // ═══════════════════════════════════════════════════════════════

  async createForm(dto: CreateIntakeFormDto) {
    await this.validateScopeTarget(dto);

    return this.prisma.intakeForm.create({
      data: {
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        type: dto.type,
        scope: dto.scope,
        serviceId: dto.serviceId ?? undefined,
        practitionerId: dto.practitionerId ?? undefined,
        branchId: dto.branchId ?? undefined,
        isActive: dto.isActive ?? true,
      },
      include: { fields: true },
    });
  }

  async updateForm(formId: string, dto: UpdateIntakeFormDto) {
    await this.ensureFormExists(formId);

    return this.prisma.intakeForm.update({
      where: { id: formId },
      data: {
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async deleteForm(formId: string) {
    await this.ensureFormExists(formId);
    await this.prisma.intakeForm.delete({ where: { id: formId } });
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIELDS
  // ═══════════════════════════════════════════════════════════════

  async setFields(formId: string, dto: SetFieldsDto) {
    await this.ensureFormExists(formId);

    return this.prisma.$transaction(async (tx) => {
      await tx.intakeField.deleteMany({ where: { formId } });

      if (dto.fields.length === 0) return [];

      await tx.intakeField.createMany({
        data: dto.fields.map((f, i) => ({
          formId,
          labelAr: f.labelAr,
          labelEn: f.labelEn,
          fieldType: f.fieldType,
          options: f.options ?? undefined,
          condition: f.condition ? (f.condition as object) : undefined,
          isRequired: f.isRequired ?? false,
          sortOrder: f.sortOrder ?? i,
        })),
      });

      await tx.intakeForm.update({
        where: { id: formId },
        data: { updatedAt: new Date() },
      });

      return tx.intakeField.findMany({
        where: { formId },
        orderBy: { sortOrder: 'asc' },
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESPONSES
  // ═══════════════════════════════════════════════════════════════

  async submitResponse(patientId: string, dto: SubmitResponseDto) {
    const formId = dto.formId!;
    await this.ensureFormExists(formId);
    await this.ensureBookingOwnership(dto.bookingId, patientId);

    const [response] = await this.prisma.$transaction([
      this.prisma.intakeResponse.create({
        data: {
          formId,
          bookingId: dto.bookingId,
          patientId,
          answers: dto.answers,
        },
      }),
      this.prisma.intakeForm.update({
        where: { id: formId },
        data: { submissionsCount: { increment: 1 } },
      }),
    ]);

    return response;
  }

  async getResponseByBooking(bookingId: string) {
    return this.prisma.intakeResponse.findMany({
      where: { bookingId },
      include: {
        form: {
          include: { fields: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async validateScopeTarget(dto: CreateIntakeFormDto) {
    try {
      if (dto.scope === 'service' && dto.serviceId) {
        const exists = await this.prisma.service.findFirst({
          where: { id: dto.serviceId, deletedAt: null },
        });
        if (!exists) throw this.notFound('Service not found');
      }

      if (dto.scope === 'practitioner' && dto.practitionerId) {
        const exists = await this.prisma.practitioner.findFirst({
          where: { id: dto.practitionerId, deletedAt: null },
        });
        if (!exists) throw this.notFound('Practitioner not found');
      }

      if (dto.scope === 'branch' && dto.branchId) {
        const exists = await this.prisma.branch.findFirst({
          where: { id: dto.branchId, deletedAt: null },
        });
        if (!exists) throw this.notFound('Branch not found');
      }
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw this.notFound('Referenced entity not found');
    }
  }

  private async ensureFormExists(formId: string) {
    const form = await this.prisma.intakeForm.findUnique({
      where: { id: formId },
    });
    if (!form) throw this.notFound('Intake form not found');
    return form;
  }

  private async ensureBookingOwnership(bookingId: string, patientId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { patientId: true },
    });
    if (!booking) throw this.notFound('Booking not found');
    if (booking.patientId !== patientId) {
      throw new ForbiddenException({ statusCode: 403, message: 'Booking does not belong to you', error: 'FORBIDDEN' });
    }
  }

  private notFound(message: string) {
    return new NotFoundException({ statusCode: 404, message, error: 'NOT_FOUND' });
  }
}
