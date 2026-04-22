import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

export interface OnboardZatcaCommand {
  vatRegistrationNumber: string;
  sellerName: string;
}

@Injectable()
export class OnboardZatcaHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: OnboardZatcaCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    // Proxy scopes findFirst to this org automatically via CLS
    const config = await this.prisma.zatcaConfig.findFirst({ where: {} });
    if (config?.isOnboarded) throw new BadRequestException('ZATCA already onboarded');

    return this.prisma.zatcaConfig.upsert({
      where: { organizationId },
      update: {
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
      create: {
        organizationId,
        vatRegistrationNumber: cmd.vatRegistrationNumber,
        sellerName: cmd.sellerName,
        isOnboarded: true,
        onboardedAt: new Date(),
      },
    });
  }
}
