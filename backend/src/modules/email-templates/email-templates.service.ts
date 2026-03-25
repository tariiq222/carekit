import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto.js';

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  LIST ALL
  // ═══════════════════════════════════════════════════════════════

  async findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  FIND BY SLUG
  // ═══════════════════════════════════════════════════════════════

  async findBySlug(slug: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug },
    });
    if (!template) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Email template not found',
        error: 'NOT_FOUND',
      });
    }
    return template;
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPDATE
  // ═══════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateEmailTemplateDto) {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Email template not found',
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        subjectAr: dto.subjectAr,
        subjectEn: dto.subjectEn,
        bodyAr: dto.bodyAr,
        bodyEn: dto.bodyEn,
        isActive: dto.isActive,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER TEMPLATE — replace {{var}} placeholders
  // ═══════════════════════════════════════════════════════════════

  async renderTemplate(
    slug: string,
    context: Record<string, unknown>,
    lang: 'ar' | 'en',
  ): Promise<{ subject: string; body: string } | null> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug },
    });

    if (!template || !template.isActive) return null;

    const subject = this.interpolate(
      lang === 'ar' ? template.subjectAr : template.subjectEn,
      context,
    );
    const body = this.interpolate(
      lang === 'ar' ? template.bodyAr : template.bodyEn,
      context,
    );

    return { subject, body };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PREVIEW — render with sample context
  // ═══════════════════════════════════════════════════════════════

  async preview(
    slug: string,
    context: Record<string, unknown>,
    lang: 'ar' | 'en',
  ) {
    const template = await this.findBySlug(slug);

    const subject = this.interpolate(
      lang === 'ar' ? template.subjectAr : template.subjectEn,
      context,
    );
    const body = this.interpolate(
      lang === 'ar' ? template.bodyAr : template.bodyEn,
      context,
    );

    return { subject, body };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PRIVATE — variable interpolation
  // ═══════════════════════════════════════════════════════════════

  private interpolate(
    text: string,
    context: Record<string, unknown>,
  ): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const val = context[key];
      if (val === undefined || val === null) return `{{${key}}}`;
      if (typeof val === 'object') return `{{${key}}}`;
      return String(val);
    });
  }
}
