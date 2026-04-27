import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { MoyasarCredentialsService } from '../../../infrastructure/payments/moyasar-credentials.service';

export interface UpsertMoyasarConfigCommand {
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
  isLive: boolean;
}

export interface UpsertMoyasarConfigResult {
  organizationId: string;
  publishableKey: string;
  isLive: boolean;
  updatedAt: Date;
}

@Injectable()
export class UpsertMoyasarConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly creds: MoyasarCredentialsService,
  ) {}

  async execute(cmd: UpsertMoyasarConfigCommand): Promise<UpsertMoyasarConfigResult> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const secretKeyEnc = this.creds.encrypt({ secretKey: cmd.secretKey }, organizationId);
    const webhookSecretEnc = cmd.webhookSecret
      ? this.creds.encrypt({ webhookSecret: cmd.webhookSecret }, organizationId)
      : null;

    const row = await this.prisma.organizationPaymentConfig.upsert({
      where: { organizationId },
      create: {
        organizationId,
        publishableKey: cmd.publishableKey,
        secretKeyEnc,
        webhookSecretEnc,
        isLive: cmd.isLive,
      },
      update: {
        publishableKey: cmd.publishableKey,
        secretKeyEnc,
        webhookSecretEnc,
        isLive: cmd.isLive,
        // updating credentials invalidates the prior verification
        lastVerifiedAt: null,
        lastVerifiedStatus: null,
      },
    });

    return {
      organizationId: row.organizationId,
      publishableKey: row.publishableKey,
      isLive: row.isLive,
      updatedAt: row.updatedAt,
    };
  }
}
