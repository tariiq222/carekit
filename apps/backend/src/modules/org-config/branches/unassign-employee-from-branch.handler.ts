import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export type UnassignEmployeeFromBranchCommand = {
  tenantId: string;
  branchId: string;
  employeeId: string;
};

@Injectable()
export class UnassignEmployeeFromBranchHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UnassignEmployeeFromBranchCommand) {
    const link = await this.prisma.employeeBranch.findFirst({
      where: {
        tenantId: dto.tenantId,
        branchId: dto.branchId,
        employeeId: dto.employeeId,
      },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Assignment not found');

    await this.prisma.employeeBranch.delete({ where: { id: link.id } });
    return { id: link.id };
  }
}
