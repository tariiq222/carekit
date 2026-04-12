import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateIntakeFormDto } from './create-intake-form.dto';

export type CreateIntakeFormCommand = CreateIntakeFormDto & { tenantId: string };

@Injectable()
export class CreateIntakeFormHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateIntakeFormCommand) {
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
                fieldType: f.fieldType,
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
