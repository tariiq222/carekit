import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { type SessionLanguage } from '@prisma/client';
import { Observable, type Subscriber } from 'rxjs';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotContextService } from './chatbot-context.service.js';
import { ChatbotStreamLoopService } from './chatbot-stream-loop.service.js';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';
import { detectLanguage } from './chatbot.helpers.js';

/** Shape of each SSE event sent to the client. */
export interface SsePayload {
  event: string;
  [key: string]: unknown;
}

@Injectable()
export class ChatbotStreamService {
  private readonly logger = new Logger(ChatbotStreamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ChatbotConfigService,
    private readonly contextService: ChatbotContextService,
    private readonly streamLoop: ChatbotStreamLoopService,
  ) {}

  /**
   * Returns an Observable<MessageEvent> suitable for SSE streaming.
   * Validates the session, builds AI context, then delegates
   * to ChatbotStreamLoopService for the streaming AI loop.
   */
  handleMessageStream(
    sessionId: string,
    userId: string,
    content: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber: Subscriber<MessageEvent>) => {
      this.processStream(sessionId, userId, content, subscriber).catch(
        (err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'Unknown error';
          this.logger.error(`Stream error: ${message}`);
          this.emit(subscriber, { event: 'error', message });
          subscriber.complete();
        },
      );
    });
  }

  // ── Core streaming pipeline ──

  private async processStream(
    sessionId: string,
    userId: string,
    content: string,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    const config = await this.configService.getConfigMap();

    // Validate session ownership and limits
    const session = await this.validateSession(sessionId, userId, config);

    // Save user message
    await this.prisma.chatMessage.create({
      data: { sessionId, role: 'user', content },
    });

    // Auto-detect language on first user message
    if (!session.language) {
      const lang = detectLanguage(content) as SessionLanguage;
      await this.prisma.chatSession.update({
        where: { id: sessionId },
        data: { language: lang },
      });
    }

    // Build AI context
    const { messages, tools } = await this.contextService.buildAiContext(
      sessionId,
      userId,
      content,
      config,
    );

    // Delegate to the stream loop service
    await this.streamLoop.runStreamLoop(
      messages,
      tools,
      config,
      sessionId,
      userId,
      subscriber,
    );

    subscriber.complete();
  }

  // ── Validation ──

  private async validateSession(
    sessionId: string,
    userId: string,
    config: ChatbotConfigMap,
  ) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Session not found',
        error: 'NOT_FOUND',
      });
    }
    if (session.endedAt) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Session has ended',
        error: 'SESSION_ENDED',
      });
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

    return session;
  }

  // ── Helpers ──

  private emit(
    subscriber: Subscriber<MessageEvent>,
    payload: SsePayload,
  ): void {
    subscriber.next({
      data: JSON.stringify(payload),
    } as MessageEvent);
  }
}
