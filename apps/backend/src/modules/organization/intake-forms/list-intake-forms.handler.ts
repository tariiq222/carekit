import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { ListIntakeFormsDto } from './intake-form.dto';

@Injectable()
export class ListIntakeFormsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListIntakeFormsDto) {
    return this.prisma.intakeForm.findMany({
      where: {
        tenantId: dto.tenantId,
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
