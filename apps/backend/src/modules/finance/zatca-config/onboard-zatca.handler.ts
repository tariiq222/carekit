import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface OnboardZatcaCommand { tenantId: string; vatRegistrationNumber: string; sellerName: string; }

@Injectable()
export class OnboardZatcaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: OnboardZatcaCommand) {
    const config = await this.prisma.zatcaConfig.findUnique({
      where: { tenantId: cmd.tenantId },
    });
    if (config?.isOnboarded) throw new BadRequestException('ZATCA already onboarded');

    return this.prisma.zatcaConfig.upsert({
      where: { tenantId: cmd.tenantId },
      update: {
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
      create: {
        tenantId: cmd.tenantId,
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
    });
  }
}
