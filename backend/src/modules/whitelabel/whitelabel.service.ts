import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { UpdateConfigDto } from './dto/update-config.dto.js';
import { WhiteLabelConfig } from '@prisma/client';

@Injectable()
export class WhitelabelService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET ALL — Return all configs ordered by key
  // ═══════════════════════════════════════════════════════════════

  async getConfig(): Promise<WhiteLabelConfig[]> {
    return this.prisma.whiteLabelConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET MAP — Return configs as { key: value } object
  // ═══════════════════════════════════════════════════════════════

  async getConfigMap(): Promise<Record<string, string>> {
    const configs = await this.prisma.whiteLabelConfig.findMany({
      orderBy: { key: 'asc' },
    });

    return configs.reduce<Record<string, string>>((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});
  }

  // ═══════════════════════════════════════════════════════════════
  //  UPSERT — Create or update each config item
  // ═══════════════════════════════════════════════════════════════

  async updateConfig(dto: UpdateConfigDto): Promise<WhiteLabelConfig[]> {
    await Promise.all(
      dto.configs.map((item) =>
        this.prisma.whiteLabelConfig.upsert({
          where: { key: item.key },
          create: {
            key: item.key,
            value: item.value,
            type: item.type ?? 'string',
            description: item.description,
          },
          update: {
            value: item.value,
            ...(item.type !== undefined && { type: item.type }),
            ...(item.description !== undefined && { description: item.description }),
          },
        }),
      ),
    );

    return this.getConfig();
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET BY KEY — Return single config item
  // ═══════════════════════════════════════════════════════════════

  async getConfigByKey(key: string): Promise<WhiteLabelConfig> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    return config;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE — Delete config by key
  // ═══════════════════════════════════════════════════════════════

  async deleteConfig(key: string): Promise<WhiteLabelConfig> {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException({
        statusCode: 404,
        message: `Config key '${key}' not found`,
        error: 'NOT_FOUND',
      });
    }

    return this.prisma.whiteLabelConfig.delete({
      where: { key },
    });
  }
}
