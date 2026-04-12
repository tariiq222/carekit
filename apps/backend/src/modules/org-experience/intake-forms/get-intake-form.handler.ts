import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetIntakeFormDto } from './intake-form.dto';

@Injectable()
export class GetIntakeFormHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GetIntakeFormDto) {
    const form = await this.prisma.intakeForm.findFirst({
      where: { id: dto.formId, tenantId: dto.tenantId },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    if (!form) throw new NotFoundException('Intake form not found');
    return form;
  }
}
