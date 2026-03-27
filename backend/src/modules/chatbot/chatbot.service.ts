import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { ChatbotToolsService } from './chatbot-tools.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotContextService } from './chatbot-context.service.js';
import { ChatbotSessionService } from './chatbot-session.service.js';
import type { OpenRouterMessage, OpenRouterTool } from './interfaces/chatbot-tool.interface.js';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';
import { detectLanguage, classifyIntent, buildActionCard } from './chatbot.helpers.js';

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
    private readonly sessionService: ChatbotSessionService,
  ) {}

  async createSession(userId: string, language?: string) {
    return this.sessionService.createSession(userId, language);
  }

  async getSession(sessionId: string, userId: string) {
    return this.sessionService.getSession(sessionId, userId);
  }

  async endSession(sessionId: string, userId: string) {
    return this.sessionService.endSession(sessionId, userId);
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
    return this.sessionService.listSessions(params);
  }

  async sendStaffMessage(sessionId: string, staffId: string, content: string) {
    return this.sessionService.sendStaffMessage(sessionId, staffId, content);
  }

  async handleMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<HandleMessageResult> {
    const config = await this.configService.getConfigMap();

    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({ statusCode: 404, message: 'Session not found', error: 'NOT_FOUND' });
    }
    if (session.endedAt) {
      throw new BadRequestException({ statusCode: 400, message: 'Session has ended', error: 'SESSION_ENDED' });
    }

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

    await this.prisma.chatMessage.create({
      data: { sessionId, role: 'user', content },
    });

    if (!session.language) {
      const detectedLang = detectLanguage(content) as Parameters<typeof this.prisma.chatSession.update>[0]['data']['language'];
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { language: detectedLang },
      });
    }

    const { messages, tools } = await this.contextService.buildAiContext(
      sessionId, userId, content, config,
    );

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

        lastActionCard = buildActionCard(toolCall.function.name, toolResult);

        await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'assistant',
            content: `[Tool: ${toolCall.function.name}]`,
            functionCall: JSON.parse(JSON.stringify({ name: toolCall.function.name, arguments: args, result: toolResult })),
            toolName: toolCall.function.name,
          },
        });

        const toolResultContent = JSON.stringify(toolResult);
        await this.prisma.chatMessage.create({
          data: {
            sessionId,
            role: 'tool' as Parameters<typeof this.prisma.chatMessage.create>[0]['data']['role'],
            content: toolResultContent,
            toolName: toolCall.function.name,
            functionCall: { tool_call_id: toolCall.id },
          },
        });

        messages.push({
          role: 'tool',
          content: toolResultContent,
          tool_call_id: toolCall.id,
        });
      }
    }

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
}
