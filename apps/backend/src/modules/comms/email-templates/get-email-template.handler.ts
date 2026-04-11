import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetEmailTemplateDto {
  tenantId: string;
  id: string;
}

@Injectable()
export class GetEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GetEmailTemplateDto) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id: dto.id } });
    if (!template || template.tenantId !== dto.tenantId) return null;
    return template;
  }
}
