import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateEmployeeDto } from './create-employee.dto';

export type CreateEmployeeCommand = CreateEmployeeDto;

@Injectable()
export class CreateEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateEmployeeCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    if (dto.email) {
      const existing = await this.prisma.employee.findFirst({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already registered for this employee');
    }

    return this.prisma.employee.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        gender: dto.gender,
        avatarUrl: dto.avatarUrl,
        bio: dto.bio,
        employmentType: dto.employmentType,
        userId: dto.userId,
        organizationId,
        branches: dto.branchIds?.length
          ? { create: dto.branchIds.map((branchId) => ({ branchId, organizationId })) }
          : undefined,
        services: dto.serviceIds?.length
          ? { create: dto.serviceIds.map((serviceId) => ({ serviceId, organizationId })) }
          : undefined,
      },
      include: { branches: true, services: true },
    });
  }
}
