import { Injectable } from '@nestjs/common';
import { ZoomApiClient } from '../../../infrastructure/zoom/zoom-api.client';
import { UpsertZoomConfigDto } from './dto/upsert-zoom-config.dto';
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class TestZoomConfigHandler {
  constructor(
    private readonly zoomApi: ZoomApiClient,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpsertZoomConfigDto) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    try {
      await this.zoomApi.getAccessToken(
        organizationId,
        dto.zoomClientId,
        dto.zoomClientSecret,
        dto.zoomAccountId,
      );
      return { ok: true };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { ok: false, error: message };
    }
  }
}
