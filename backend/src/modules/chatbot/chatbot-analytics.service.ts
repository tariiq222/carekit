import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

interface DateRange {
  from?: string;
  to?: string;
}

export interface SessionStats {
  totalSessions: number;
  avgMessagesPerSession: number;
  handoffRate: number;
  totalMessages: number;
  languageDistribution: Record<string, number>;
  topIntents: { intent: string; count: number }[];
  topTools: { tool: string; count: number }[];
  estimatedTokens: number;
}

@Injectable()
export class ChatbotAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSessionStats(range?: DateRange): Promise<SessionStats> {
    const dateFilter = this.buildDateFilter(range);

    const [totalSessions, handedOffCount, totalMessages, tokenSum] =
      await Promise.all([
        this.prisma.chatSession.count({ where: dateFilter }),
        this.prisma.chatSession.count({
          where: { ...dateFilter, handedOff: true },
        }),
        this.prisma.chatMessage.count({
          where: { session: dateFilter },
        }),
        this.prisma.chatMessage.aggregate({
          where: { session: dateFilter, tokenCount: { not: null } },
          _sum: { tokenCount: true },
        }),
      ]);

    const avgMessagesPerSession =
      totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0;
    const handoffRate =
      totalSessions > 0
        ? Math.round((handedOffCount / totalSessions) * 100)
        : 0;

    const languageDistribution = await this.getLanguageDistribution(dateFilter);
    const topIntents = await this.getTopIntents(dateFilter);
    const topTools = await this.getTopTools(dateFilter);

    return {
      totalSessions,
      avgMessagesPerSession,
      handoffRate,
      totalMessages,
      languageDistribution,
      topIntents,
      topTools,
      estimatedTokens: tokenSum._sum.tokenCount ?? 0,
    };
  }

  async getMostAskedQuestions(
    limit = 10,
  ): Promise<{ content: string; count: number }[]> {
    // Get the most common user messages (simplified — in production, use NLP clustering)
    const messages = await this.prisma.chatMessage.groupBy({
      by: ['content'],
      where: { role: 'user' },
      _count: { content: true },
      orderBy: { _count: { content: 'desc' } },
      take: limit,
    });

    return messages.map((m) => ({
      content: m.content,
      count: m._count.content,
    }));
  }

  private async getLanguageDistribution(
    dateFilter: Record<string, unknown>,
  ): Promise<Record<string, number>> {
    const sessions = await this.prisma.chatSession.groupBy({
      by: ['language'],
      where: dateFilter,
      _count: { language: true },
    });

    const result: Record<string, number> = {};
    for (const s of sessions) {
      result[s.language ?? 'unknown'] = s._count.language;
    }
    return result;
  }

  private async getTopIntents(
    dateFilter: Record<string, unknown>,
  ): Promise<{ intent: string; count: number }[]> {
    const intents = await this.prisma.chatMessage.groupBy({
      by: ['intent'],
      where: { session: dateFilter, intent: { not: null } },
      _count: { intent: true },
      orderBy: { _count: { intent: 'desc' } },
      take: 10,
    });

    return intents.map((i) => ({
      intent: i.intent ?? '',
      count: i._count.intent,
    }));
  }

  private async getTopTools(
    dateFilter: Record<string, unknown>,
  ): Promise<{ tool: string; count: number }[]> {
    const tools = await this.prisma.chatMessage.groupBy({
      by: ['toolName'],
      where: { session: dateFilter, toolName: { not: null } },
      _count: { toolName: true },
      orderBy: { _count: { toolName: 'desc' } },
      take: 10,
    });

    return tools.map((t) => ({
      tool: t.toolName ?? '',
      count: t._count.toolName,
    }));
  }

  private buildDateFilter(range?: DateRange): Record<string, unknown> {
    if (!range?.from && !range?.to) return {};

    const filter: Record<string, unknown> = {};
    const createdAt: Record<string, Date> = {};

    if (range.from) createdAt.gte = new Date(range.from);
    if (range.to) createdAt.lte = new Date(range.to);

    filter.createdAt = createdAt;
    return filter;
  }
}
