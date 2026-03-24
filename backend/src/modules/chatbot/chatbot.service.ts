import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type SessionLanguage } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { ChatbotToolsService } from './chatbot-tools.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotContextService } from './chatbot-context.service.js';
import type { OpenRouterMessage, OpenRouterTool } from './interfaces/chatbot-tool.interface.js';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';
import { detectLanguage, classifyIntent, buildActionCard } from './chatbot.helpers.js';
import { parsePaginationParams, buildPaginationMeta } from '../../common/helpers/pagination.helper.js';
import { buildDateRangeFilter } from '../../common/helpers/date-filter.helper.js';

export interface HandleMessageResult {
  message: string;
  intent?: string;
  toolName?: string;
  actionCard?: { type: string; payload: unknown };
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: ChatbotAiService,
    private readonly toolsService: ChatbotToolsService,
    private readonly configService: ChatbotConfigService,
    private readonly contextService: ChatbotContextService,
  ) {}

  async createSession(userId: string, language?: string) {
    const config = await this.configService.getConfigMap();

    const session = await this.prisma.chatSession.create({
      data: { userId, language: language as SessionLanguage | undefined },
    });

    // Send welcome message
    const welcomeMsg =
      language === 'en' ? config.welcome_message_en : config.welcome_message_ar;

    await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: welcomeMsg,
        intent: 'greeting',
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

  async handleMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<HandleMessageResult> {
    const config = await this.configService.getConfigMap();

    // Check session exists and belongs to user
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({ statusCode: 404, message: 'Session not found', error: 'NOT_FOUND' });
    }
    if (session.endedAt) {
      throw new BadRequestException({ statusCode: 400, message: 'Session has ended', error: 'SESSION_ENDED' });
    }

    // Check max messages
    const messageCount = await this.prisma.chatMessage.count({
      where: { sessionId },
    });
    if (messageCount >= config.max_messages_per_session) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Maximum messages per session reached',
        error: 'MAX_MESSAGES_REACHED',
      });
    }

    // Save user message
    await this.prisma.chatMessage.create({
      data: { sessionId, role: 'user', content },
    });

    // Detect language from first user message
    if (!session.language) {
      const detectedLang = detectLanguage(content) as SessionLanguage;
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { language: detectedLang },
      });
    }

    // Build context
    const { messages, tools } = await this.contextService.buildAiContext(
      sessionId, userId, content, config,
    );

    // AI loop — handle tool calls iteratively
    return this.runAiLoop(messages, tools, config, sessionId, userId);
  }

  private async runAiLoop(
    messages: OpenRouterMessage[],
    tools: OpenRouterTool[],
    config: ChatbotConfigMap,
    sessionId: string,
    userId: string,
  ): Promise<HandleMessageResult> {
    let lastToolName: string | undefined;
    let lastActionCard: { type: string; payload: unknown } | undefined;
    let totalTokens = 0;

    for (let i = 0; i < config.max_tool_calls_per_message; i++) {
      const result = await this.aiService.chatCompletion(messages, tools, config);
      totalTokens += result.tokenCount;

      // No tool calls — final text response
      if (result.toolCalls.length === 0) {
        const responseText = result.content ?? '';

        await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'assistant',
            content: responseText,
            intent: classifyIntent(lastToolName),
            toolName: lastToolName,
            tokenCount: totalTokens,
          },
        });

        return {
          message: responseText,
          intent: classifyIntent(lastToolName),
          toolName: lastToolName,
          actionCard: lastActionCard,
        };
      }

      // Process tool calls
      const assistantMsg: OpenRouterMessage = {
        role: 'assistant',
        content: result.content,
        tool_calls: result.toolCalls,
      };
      messages.push(assistantMsg);

      for (const toolCall of result.toolCalls) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        lastToolName = toolCall.function.name;

        this.logger.log(`Executing tool: ${toolCall.function.name}`);

        const toolResult = await this.toolsService.execute(
          toolCall.function.name,
          args,
          { userId, sessionId },
        );

        // Build action card from tool results
        lastActionCard = buildActionCard(toolCall.function.name, toolResult);

        // Save tool call in message
        await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'assistant',
            content: `[Tool: ${toolCall.function.name}]`,
            functionCall: JSON.parse(JSON.stringify({ name: toolCall.function.name, arguments: args, result: toolResult })),
            toolName: toolCall.function.name,
          },
        });

        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id,
        });
      }
    }

    // Max tool calls reached — get final response without tools
    const finalResult = await this.aiService.chatCompletion(messages, [], config);
    const finalText = finalResult.content ?? 'I apologize, I encountered an issue. Please try again.';

    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: finalText,
        intent: classifyIntent(lastToolName),
        tokenCount: totalTokens + finalResult.tokenCount,
      },
    });

    return { message: finalText, intent: classifyIntent(lastToolName), actionCard: lastActionCard };
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

}
