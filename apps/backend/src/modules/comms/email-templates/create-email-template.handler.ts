import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateEmailTemplateDto } from './create-email-template.dto';

export type CreateEmailTemplateCommand = CreateEmailTemplateDto & { tenantId: string };

@Injectable()
export class CreateEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreateEmailTemplateCommand) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { tenantId_slug: { tenantId: cmd.tenantId, slug: cmd.slug } },
    });
    if (existing) {
      throw new ConflictException(`Template "${cmd.slug}" already exists for this tenant`);
    }

    return this.prisma.emailTemplate.create({
      data: {
        tenantId: cmd.tenantId,
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
