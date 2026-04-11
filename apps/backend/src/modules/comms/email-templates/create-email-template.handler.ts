import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateEmailTemplateDto {
  tenantId: string;
  slug: string;
  nameAr: string;
  nameEn?: string;
  subjectAr: string;
  subjectEn?: string;
  htmlBody: string;
}

@Injectable()
export class CreateEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: CreateEmailTemplateDto) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { tenantId_slug: { tenantId: dto.tenantId, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`Template "${dto.slug}" already exists for this tenant`);
    }

    return this.prisma.emailTemplate.create({
      data: {
        tenantId: dto.tenantId,
        slug: dto.slug,
        nameAr: dto.nameAr,
        nameEn: dto.nameEn,
        subjectAr: dto.subjectAr,
        subjectEn: dto.subjectEn,
        htmlBody: dto.htmlBody,
      },
    });
  }
}
