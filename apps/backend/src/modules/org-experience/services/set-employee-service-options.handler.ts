import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface EmployeeServiceOptionInput {
  durationOptionId: string;
  priceOverride?: number | null;
  durationOverride?: number | null;
  isActive?: boolean;
}

export interface SetEmployeeServiceOptionsDto {
  tenantId: string;
  employeeServiceId: string;
  options: EmployeeServiceOptionInput[];
}

@Injectable()
export class SetEmployeeServiceOptionsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: SetEmployeeServiceOptionsDto) {
    // Verify each durationOptionId belongs to the tenant
    const optionIds = dto.options.map((o) => o.durationOptionId);
    const validOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: optionIds }, tenantId: dto.tenantId },
      select: { id: true },
    });
    const validIds = new Set(validOptions.map((o) => o.id));
    const invalid = optionIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new NotFoundException(`ServiceDurationOption(s) not found: ${invalid.join(', ')}`);
    }

    const upserts = dto.options.map((opt) =>
      this.prisma.employeeServiceOption.upsert({
        where: {
          employeeServiceId_durationOptionId: {
            employeeServiceId: dto.employeeServiceId,
            durationOptionId: opt.durationOptionId,
          },
        },
        create: {
          tenantId: dto.tenantId,
          employeeServiceId: dto.employeeServiceId,
          durationOptionId: opt.durationOptionId,
          priceOverride: opt.priceOverride ?? null,
          durationOverride: opt.durationOverride ?? null,
          isActive: opt.isActive ?? true,
        },
        update: {
          priceOverride: opt.priceOverride ?? null,
          durationOverride: opt.durationOverride ?? null,
          ...(opt.isActive !== undefined && { isActive: opt.isActive }),
        },
      }),
    );

    await this.prisma.$transaction(upserts);

    return this.prisma.employeeServiceOption.findMany({
      where: { employeeServiceId: dto.employeeServiceId, tenantId: dto.tenantId },
      include: { durationOption: true },
    });
  }
}
