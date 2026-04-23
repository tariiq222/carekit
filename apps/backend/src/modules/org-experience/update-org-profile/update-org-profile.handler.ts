import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { UpdateOrgProfileDto } from './update-org-profile.dto';

@Injectable()
export class UpdateOrgProfileHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: UpdateOrgProfileDto): Promise<void> {
    const organizationId = this.tenant.requireOrganizationId();

    if (dto.slug) {
      const existing = await this.prisma.organization.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });
      if (existing && existing.id !== organizationId) {
        throw new ConflictException('SLUG_TAKEN');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn,
          slug: dto.slug,
        },
      });

      await tx.brandingConfig.upsert({
        where: { organizationId },
        create: {
          organizationId,
          organizationNameAr: dto.nameAr ?? 'منظمتي',
          organizationNameEn: dto.nameEn,
          productTagline: dto.tagline,
        },
        update: {
          organizationNameAr: dto.nameAr,
          organizationNameEn: dto.nameEn,
          productTagline: dto.tagline,
        },
      });
    });
  }
}