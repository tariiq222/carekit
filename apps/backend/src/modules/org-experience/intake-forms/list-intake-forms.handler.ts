import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListIntakeFormsDto } from './list-intake-forms.dto';

export type ListIntakeFormsCommand = ListIntakeFormsDto;

@Injectable()
export class ListIntakeFormsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: ListIntakeFormsCommand) {
    return this.prisma.intakeForm.findMany({
      where: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { fields: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
