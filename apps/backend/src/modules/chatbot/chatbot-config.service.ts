import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { CHATBOT_CONFIG_DEFAULTS } from './constants/config-defaults.js';
import type {
  ChatbotConfigMap,
  ChatbotConfigEntry,
} from './interfaces/chatbot-config.interface.js';

@Injectable()
export class ChatbotConfigService {
  private readonly logger = new Logger(ChatbotConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.chatbotConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getByCategory(category: string) {
    return this.prisma.chatbotConfig.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Returns a fully typed config map with defaults for any missing keys.
   * This is the main method used by the chatbot engine at runtime.
   */
  async getConfigMap(): Promise<ChatbotConfigMap> {
    const dbConfigs = await this.prisma.chatbotConfig.findMany();

    const configMap = new Map<string, unknown>();

    // Start with defaults
    for (const def of CHATBOT_CONFIG_DEFAULTS) {
      configMap.set(def.key, def.value);
    }

    // Override with DB values
    for (const entry of dbConfigs) {
      configMap.set(entry.key, entry.value);
    }

    return Object.fromEntries(configMap) as unknown as ChatbotConfigMap;
  }

  async upsert(key: string, value: unknown, category: string) {
    return this.prisma.chatbotConfig.upsert({
      where: { key },
      create: { key, value: value as never, category },
      update: { value: value as never, category },
    });
  }

  async bulkUpsert(configs: ChatbotConfigEntry[]) {
    await Promise.all(
      configs.map((c) => this.upsert(c.key, c.value, c.category)),
    );
    return this.getAll();
  }

  /**
   * Seeds default config values. Only inserts keys that don't exist yet.
   */
  async seedDefaults(): Promise<number> {
    let seeded = 0;

    for (const def of CHATBOT_CONFIG_DEFAULTS) {
      const existing = await this.prisma.chatbotConfig.findUnique({
        where: { key: def.key },
      });

      if (!existing) {
        await this.prisma.chatbotConfig.create({
          data: {
            key: def.key,
            value: def.value as never,
            category: def.category,
          },
        });
        seeded++;
      }
    }

    this.logger.log(`Seeded ${seeded} default chatbot config entries`);
    return seeded;
  }
}
