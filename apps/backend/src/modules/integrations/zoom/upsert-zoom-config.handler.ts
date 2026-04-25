import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ZoomCredentialsService } from '../../../infrastructure/zoom/zoom-credentials.service';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class UpsertZoomConfigHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomCredentials: ZoomCredentialsService,
    private readonly zoomApi: ZoomApiClient,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertZoomConfigDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const encryptedConfig = this.zoomCredentials.encrypt(
      {
        zoomClientId: dto.zoomClientId,
        zoomClientSecret: dto.zoomClientSecret,
        zoomAccountId: dto.zoomAccountId,
      },
      organizationId,
    );

    await this.prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'zoom',
        },
      },
      update: {
        config: { ciphertext: encryptedConfig },
        isActive: true,
      },
      create: {
        organizationId,
        provider: 'zoom',
        config: { ciphertext: encryptedConfig },
        isActive: true,
      },
    });

    // Invalidate cached OAuth token so the new credentials take effect immediately
    // instead of waiting up to ~1h for the previous token to expire.
    this.zoomApi.invalidateToken(organizationId);

    return { configured: true, isActive: true };
  }
}
