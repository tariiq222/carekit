import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeGender, OnboardingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface EmployeeOnboardingCommand {
  employeeId: string;
  tenantId: string;
  step: 'profile' | 'specialties' | 'branches' | 'services' | 'complete';
  profile?: {
    name?: string;
    phone?: string;
    email?: string;
    gender?: EmployeeGender;
    bio?: string;
    avatarUrl?: string;
  };
  specialtyIds?: string[];
  branchIds?: string[];
  serviceIds?: string[];
}

@Injectable()
export class EmployeeOnboardingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: EmployeeOnboardingCommand) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: cmd.employeeId },
    });

    if (!employee || employee.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Employee ${cmd.employeeId} not found`);
    }

    switch (cmd.step) {
      case 'profile': {
        await this.prisma.employee.update({
          where: { id: cmd.employeeId },
          data: {
            ...cmd.profile,
            ...(employee.onboardingStatus === OnboardingStatus.PENDING && {
              onboardingStatus: OnboardingStatus.IN_PROGRESS,
            }),
          },
        });
        break;
      }

      case 'specialties': {
        await this.prisma.employeeSpecialty.deleteMany({
          where: { employeeId: cmd.employeeId },
        });
        if (cmd.specialtyIds?.length) {
          await this.prisma.employeeSpecialty.createMany({
            data: cmd.specialtyIds.map((specialtyId) => ({
              tenantId: cmd.tenantId,
              employeeId: cmd.employeeId,
              specialtyId,
            })),
          });
        }
        if (employee.onboardingStatus === OnboardingStatus.PENDING) {
          await this.prisma.employee.update({
            where: { id: cmd.employeeId },
            data: { onboardingStatus: OnboardingStatus.IN_PROGRESS },
          });
        }
        break;
      }

      case 'branches': {
        await this.prisma.employeeBranch.deleteMany({
          where: { employeeId: cmd.employeeId },
        });
        if (cmd.branchIds?.length) {
          await this.prisma.employeeBranch.createMany({
            data: cmd.branchIds.map((branchId) => ({
              tenantId: cmd.tenantId,
              employeeId: cmd.employeeId,
              branchId,
            })),
          });
        }
        if (employee.onboardingStatus === OnboardingStatus.PENDING) {
          await this.prisma.employee.update({
            where: { id: cmd.employeeId },
            data: { onboardingStatus: OnboardingStatus.IN_PROGRESS },
          });
        }
        break;
      }

      case 'services': {
        await this.prisma.employeeService.deleteMany({
          where: { employeeId: cmd.employeeId },
        });
        if (cmd.serviceIds?.length) {
          await this.prisma.employeeService.createMany({
            data: cmd.serviceIds.map((serviceId) => ({
              tenantId: cmd.tenantId,
              employeeId: cmd.employeeId,
              serviceId,
            })),
          });
        }
        if (employee.onboardingStatus === OnboardingStatus.PENDING) {
          await this.prisma.employee.update({
            where: { id: cmd.employeeId },
            data: { onboardingStatus: OnboardingStatus.IN_PROGRESS },
          });
        }
        break;
      }

      case 'complete': {
        await this.prisma.employee.update({
          where: { id: cmd.employeeId },
          data: { onboardingStatus: OnboardingStatus.COMPLETED },
        });
        break;
      }
    }

    return this.prisma.employee.findUnique({
      where: { id: cmd.employeeId },
      include: { specialties: true, branches: true, services: true },
    });
  }
}
