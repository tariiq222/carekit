import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateEmailTemplateDto } from './update-email-template.dto';

export type UpdateEmailTemplateCommand = UpdateEmailTemplateDto & {
  tenantId: string;
  id: string;
};

@Injectable()
export class UpdateEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmailTemplateCommand) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id: cmd.id } });
    if (!template || template.tenantId !== cmd.tenantId) {
      throw new NotFoundException(`Email template ${cmd.id} not found`);
    }

    return this.prisma.emailTemplate.update({
      where: { id: cmd.id },
      data: {
        ...(cmd.nameAr !== undefined ? { nameAr: cmd.nameAr } : {}),
        ...(cmd.nameEn !== undefined ? { nameEn: cmd.nameEn } : {}),
        ...(cmd.subjectAr !== undefined ? { subjectAr: cmd.subjectAr } : {}),
        ...(cmd.subjectEn !== undefined ? { subjectEn: cmd.subjectEn } : {}),
        ...(cmd.htmlBody !== undefined ? { htmlBody: cmd.htmlBody } : {}),
        ...(cmd.isActive !== undefined ? { isActive: cmd.isActive } : {}),
      },
    });
  }
}
