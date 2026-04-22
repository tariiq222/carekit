import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { BulkUpsertSiteSettingsDto } from './bulk-upsert-site-settings.dto';

@Injectable()
export class BulkUpsertSiteSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: BulkUpsertSiteSettingsDto): Promise<{ updated: number }> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    await this.prisma.$transaction(
      dto.entries.map((e) =>
        this.prisma.siteSetting.upsert({
          where: { organizationId_key: { organizationId, key: e.key } },
          create: {
            organizationId,
            key: e.key,
            valueText: e.valueText ?? null,
            valueAr: e.valueAr ?? null,
            valueEn: e.valueEn ?? null,
            valueJson: (e.valueJson ?? Prisma.DbNull) as Prisma.InputJsonValue,
            valueMedia: e.valueMedia ?? null,
          },
          update: {
            valueText: e.valueText ?? null,
            valueAr: e.valueAr ?? null,
            valueEn: e.valueEn ?? null,
            valueJson: (e.valueJson ?? Prisma.DbNull) as Prisma.InputJsonValue,
            valueMedia: e.valueMedia ?? null,
          },
        }),
      ),
    );
    return { updated: dto.entries.length };
  }
}
