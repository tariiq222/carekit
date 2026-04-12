import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { GetEmailTemplateDto } from './get-email-template.dto';

export type GetEmailTemplateCommand = GetEmailTemplateDto & { tenantId: string };

@Injectable()
export class GetEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: GetEmailTemplateCommand) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id: cmd.id } });
    if (!template || template.tenantId !== cmd.tenantId) return null;
    return template;
  }
}
