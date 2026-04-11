import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { ClinicTheme } from '@carekit/shared/types';
import { DEFAULT_THEME } from '@carekit/shared/types';
import type { UpdateThemeDto } from './dto/update-theme.dto.js';

@Injectable()
export class ThemeService {
  constructor(private readonly prisma: PrismaService) {}

  async getTheme(): Promise<ClinicTheme> {
    const settings = await this.prisma.clinicSettings.findFirst({
      select: { theme: true },
    })

    if (!settings) return DEFAULT_THEME

    return {
      ...DEFAULT_THEME,
      ...((settings.theme as Partial<ClinicTheme>) ?? {}),
    }
  }

  async updateTheme(patch: UpdateThemeDto): Promise<ClinicTheme> {
    const existing = await this.prisma.clinicSettings.findFirst({
      select: { id: true, theme: true },
    })

    if (!existing) {
      throw new NotFoundException('ClinicSettings record not found')
    }

    const current = (existing.theme as Partial<ClinicTheme>) ?? {}
    const merged = { ...current, ...patch }

    await this.prisma.clinicSettings.update({
      where: { id: existing.id },
      data: { theme: merged },
    })

    return { ...DEFAULT_THEME, ...merged }
  }

  async resetTheme(): Promise<ClinicTheme> {
    const existing = await this.prisma.clinicSettings.findFirst({
      select: { id: true },
    })

    if (!existing) {
      throw new NotFoundException('ClinicSettings record not found')
    }

    await this.prisma.clinicSettings.update({
      where: { id: existing.id },
      data: { theme: null },
    })

    return DEFAULT_THEME
  }
}
