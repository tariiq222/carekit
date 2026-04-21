import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateEmployeeDto } from './create-employee.dto';

export type CreateEmployeeCommand = CreateEmployeeDto;

@Injectable()
export class CreateEmployeeHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateEmployeeCommand) {
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
        branches: dto.branchIds?.length
          ? { create: dto.branchIds.map((branchId) => ({ branchId })) }
          : undefined,
        services: dto.serviceIds?.length
          ? { create: dto.serviceIds.map((serviceId) => ({ serviceId })) }
          : undefined,
      },
      include: { branches: true, services: true },
    });
  }
}
