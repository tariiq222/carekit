import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CreateIntakeFormDto } from './dto/create-intake-form.dto.js';
import { UpdateIntakeFormDto } from './dto/update-intake-form.dto.js';
import { SetFieldsDto } from './dto/set-fields.dto.js';
import { SubmitResponseDto } from './dto/submit-response.dto.js';

@Injectable()
export class IntakeFormsService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  FORMS
  // ═══════════════════════════════════════════════════════════════

  async getFormsByService(serviceId: string) {
    return this.prisma.intakeForm.findMany({
      where: { serviceId, isActive: true },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAllFormsByService(serviceId: string) {
    return this.prisma.intakeForm.findMany({
      where: { serviceId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createForm(serviceId: string, dto: CreateIntakeFormDto) {
    await this.ensureServiceExists(serviceId);

    return this.prisma.intakeForm.create({
      data: {
        serviceId,
        titleAr: dto.titleAr,
        titleEn: dto.titleEn,
        isRequired: dto.isRequired ?? false,
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
        titleAr: dto.titleAr,
        titleEn: dto.titleEn,
        isRequired: dto.isRequired,
        isActive: dto.isActive,
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
          isRequired: f.isRequired ?? false,
          sortOrder: f.sortOrder ?? i,
        })),
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
    await this.ensureFormExists(dto.formId);

    return this.prisma.intakeResponse.create({
      data: {
        formId: dto.formId,
        bookingId: dto.bookingId,
        patientId,
        answers: dto.answers,
      },
    });
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

  private async ensureServiceExists(serviceId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Service not found',
        error: 'NOT_FOUND',
      });
    }
    return service;
  }

  private async ensureFormExists(formId: string) {
    const form = await this.prisma.intakeForm.findUnique({
      where: { id: formId },
    });
    if (!form) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Intake form not found',
        error: 'NOT_FOUND',
      });
    }
    return form;
  }
}
