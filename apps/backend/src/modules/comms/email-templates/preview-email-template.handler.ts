import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface PreviewEmailTemplateCommand {
  tenantId: string;
  id: string;
  context: Record<string, unknown>;
  lang: 'ar' | 'en';
}

@Injectable()
export class PreviewEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: PreviewEmailTemplateCommand): Promise<{ subject: string; body: string }> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: cmd.id, tenantId: cmd.tenantId },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    const rawSubject = (cmd.lang === 'ar' ? template.subjectAr : template.subjectEn) ?? '';
    const rawBody = (cmd.lang === 'ar' ? template.bodyAr : template.bodyEn) ?? '';

    const interpolate = (str: string): string =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        String(cmd.context[key] ?? ''),
      );

    return {
      subject: interpolate(rawSubject),
      body: interpolate(rawBody),
    };
  }
}
