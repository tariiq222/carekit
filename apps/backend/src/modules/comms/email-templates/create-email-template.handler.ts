import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateEmailTemplateDto } from './create-email-template.dto';

export type CreateEmailTemplateCommand = CreateEmailTemplateDto;

@Injectable()
export class CreateEmailTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateEmailTemplateCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    // SaaS-02f: slug uniqueness is now per-org (composite unique). The Proxy
    // auto-scopes `where` by organizationId, so findFirst by slug is safe.
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { slug: cmd.slug },
    });
    if (existing) {
      throw new ConflictException(`Template "${cmd.slug}" already exists`);
    }

    return this.prisma.emailTemplate.create({
      data: {
        organizationId, // SaaS-02f
        slug: cmd.slug,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        subjectAr: cmd.subjectAr,
        subjectEn: cmd.subjectEn,
        htmlBody: cmd.htmlBody,
      },
    });
  }
}
