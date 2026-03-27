import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type SessionLanguage, ChatIntent } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { buildDateRangeFilter } from '../../common/helpers/date-filter.helper.js';

@Injectable()
export class ChatbotSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ChatbotConfigService,
  ) {}

  async createSession(userId: string, language?: string) {
    const config = await this.configService.getConfigMap();

    const session = await this.prisma.chatSession.create({
      data: { userId, language: language as SessionLanguage | undefined },
    });

    const welcomeMsg =
      language === 'en' ? config.welcome_message_en : config.welcome_message_ar;

    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: welcomeMsg,
        intent: ChatIntent.greeting,
      },
    });

    return {
      session,
      welcomeMessage: welcomeMsg,
      quickReplies: config.quick_replies,
      botConfig: {
        bot_name: config.bot_name,
        bot_avatar_url: config.bot_avatar_url,
        tone: config.tone,
      },
    };
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException({ statusCode: 404, message: 'Session not found', error: 'NOT_FOUND' });
    }

    return session;
  }

  async endSession(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({ statusCode: 404, message: 'Session not found', error: 'NOT_FOUND' });
    }

    return this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });
  }

  async listSessions(params: {
    userId?: string;
    page?: number;
    perPage?: number;
    handedOff?: boolean;
    language?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }) {
    const { page, perPage, skip } = parsePaginationParams(params.page, params.perPage);
    const where: Record<string, unknown> = {};

    if (params.userId) where.userId = params.userId;
    if (params.handedOff !== undefined) where.handedOff = params.handedOff;
    if (params.language) where.language = params.language;
    const dateRange = buildDateRangeFilter(params.dateFrom, params.dateTo);
    if (dateRange) where.createdAt = dateRange;

    const include = {
      user: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { messages: true } },
    };

    const [items, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
      }),
      this.prisma.chatSession.count({ where }),
    ]);

    return {
      items,
      meta: buildPaginationMeta(total, page, perPage),
    };
  }

  async sendStaffMessage(sessionId: string, staffId: string, content: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException({ statusCode: 404, message: 'Session not found', error: 'NOT_FOUND' });
    }
    if (!session.handedOff || session.handoffType !== 'live_chat') {
      throw new BadRequestException('Session is not handed off to live chat');
    }
    if (session.endedAt) {
      throw new BadRequestException('Session has already ended');
    }

    return this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'staff',
        content,
        staffId,
      },
    });
  }
}
