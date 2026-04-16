import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

export interface OnboardZatcaCommand {
  vatRegistrationNumber: string;
  sellerName: string;
}

@Injectable()
export class OnboardZatcaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: OnboardZatcaCommand) {
    const config = await this.prisma.zatcaConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (config?.isOnboarded) throw new BadRequestException('ZATCA already onboarded');

    return this.prisma.zatcaConfig.upsert({
      where: { id: SINGLETON_ID },
      update: {
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
      create: {
        id: SINGLETON_ID,
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
    });
  }
}