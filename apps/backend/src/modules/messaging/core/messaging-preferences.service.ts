import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';

type ChannelName = 'push' | 'email' | 'sms';

interface CategoryPrefs {
  push?: boolean;
  email?: boolean;
  sms?: boolean;
}

interface ResolvedPreferences {
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  categories: Record<string, CategoryPrefs>;
}

@Injectable()
export class MessagingPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(userId: string): Promise<ResolvedPreferences> {
    const record = await this.prisma.messagingPreference.findUnique({
      where: { userId },
    });

    if (!record) {
      return {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
        categories: {},
      };
    }

    return {
      pushEnabled: record.pushEnabled,
      emailEnabled: record.emailEnabled,
      smsEnabled: record.smsEnabled,
      categories: (record.categories as Record<string, CategoryPrefs>) ?? {},
    };
  }

  /**
   * Returns true only if both the global channel switch AND the
   * per-category override (if present) allow the message through.
   * Missing category entry defaults to true (opt-in by default).
   */
  async isChannelEnabled(
    userId: string,
    channel: ChannelName,
    category: string,
  ): Promise<boolean> {
    const prefs = await this.resolve(userId);

    const globalKey = `${channel}Enabled` as keyof ResolvedPreferences;
    if (!prefs[globalKey]) return false;

    const categoryPrefs = prefs.categories[category];
    if (categoryPrefs && channel in categoryPrefs) {
      return categoryPrefs[channel] !== false;
    }

    return true;
  }
}
