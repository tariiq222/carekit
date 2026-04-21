import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { OnboardEmployeeDto } from './onboard-employee.dto';

export type OnboardEmployeeCommand = OnboardEmployeeDto;

@Injectable()
export class OnboardEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: OnboardEmployeeCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const existing = await this.prisma.employee.findFirst({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered for this employee');

    const employee = await this.prisma.employee.create({
      data: {
        name: dto.nameAr || dto.nameEn,
        nameEn: dto.nameEn,
        nameAr: dto.nameAr,
        title: dto.title,
        specialty: dto.specialty,
        specialtyAr: dto.specialtyAr,
        email: dto.email,
        phone: dto.phone,
        gender: dto.gender,
        employmentType: dto.employmentType ?? 'FULL_TIME',
        bio: dto.bio,
        bioAr: dto.bioAr,
        education: dto.education,
        educationAr: dto.educationAr,
        experience: dto.experience,
        avatarUrl: dto.avatarUrl ?? undefined,
        isActive: dto.isActive ?? true,
        organizationId,
      },
      include: { branches: true, services: true },
    });

    return {
      success: true,
      message: 'Employee onboarded successfully',
      employee,
    };
  }
}
