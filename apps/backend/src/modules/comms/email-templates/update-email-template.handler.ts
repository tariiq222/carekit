import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface UpdateEmailTemplateDto {
  tenantId: string;
  id: string;
  nameAr?: string;
  nameEn?: string;
  subjectAr?: string;
  subjectEn?: string;
  htmlBody?: string;
  isActive?: boolean;
}

@Injectable()
export class UpdateEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpdateEmailTemplateDto) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id: dto.id } });
    if (!template || template.tenantId !== dto.tenantId) {
      throw new NotFoundException(`Email template ${dto.id} not found`);
    }

    return this.prisma.emailTemplate.update({
      where: { id: dto.id },
      data: {
        ...(dto.nameAr !== undefined ? { nameAr: dto.nameAr } : {}),
        ...(dto.nameEn !== undefined ? { nameEn: dto.nameEn } : {}),
        ...(dto.subjectAr !== undefined ? { subjectAr: dto.subjectAr } : {}),
        ...(dto.subjectEn !== undefined ? { subjectEn: dto.subjectEn } : {}),
        ...(dto.htmlBody !== undefined ? { htmlBody: dto.htmlBody } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }
}
