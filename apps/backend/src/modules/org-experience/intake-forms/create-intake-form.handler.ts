import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { CreateIntakeFormDto } from './intake-form.dto';

@Injectable()
export class CreateIntakeFormHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateIntakeFormDto) {
    return this.prisma.intakeForm.create({
      data: {
        tenantId: dto.tenantId,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        fields: dto.fields?.length
          ? {
              create: dto.fields.map((f, i) => ({
                tenantId: dto.tenantId,
                labelAr: f.labelAr,
                labelEn: f.labelEn,
                fieldType: f.fieldType as never,
                isRequired: f.isRequired ?? false,
                options: f.options ?? undefined,
                position: f.position ?? i,
              })),
            }
          : undefined,
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }
}
