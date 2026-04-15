import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type DeleteDepartmentCommand = { tenantId: string; departmentId: string };

@Injectable()
export class DeleteDepartmentHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: DeleteDepartmentCommand) {
    const result = await this.prisma.department.deleteMany({
      where: { id: dto.departmentId, tenantId: dto.tenantId },
    });

    if (result.count === 0) throw new NotFoundException('Department not found');

    return { deleted: true };
  }
}
