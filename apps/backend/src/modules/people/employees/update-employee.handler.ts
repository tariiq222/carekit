import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateEmployeeDto } from './update-employee.dto';

export type UpdateEmployeeCommand = UpdateEmployeeDto & {
  employeeId: string;
};

@Injectable()
export class UpdateEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmployeeCommand) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const { employeeId: _e, avatarUrl, ...rest } = cmd;
    const data: Record<string, unknown> = { ...rest };
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (cmd.nameAr || cmd.nameEn) {
      data.name = cmd.nameAr ?? cmd.nameEn ?? employee.name;
    }

    return this.prisma.employee.update({
      where: { id: cmd.employeeId },
      data,
      include: { specialties: true, branches: true, services: true },
    });
  }
}
