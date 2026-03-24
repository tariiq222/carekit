import { Injectable, Logger } from '@nestjs/common';
import type { Subscriber } from 'rxjs';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotAiService } from './chatbot-ai.service.js';
import { ChatbotToolsService } from './chatbot-tools.service.js';
import type {
  OpenRouterMessage,
  OpenRouterTool,
  ToolCall,
} from './interfaces/chatbot-tool.interface.js';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';
import { classifyIntent, buildActionCard } from './chatbot.helpers.js';
import type { SsePayload } from './chatbot-stream.service.js';

@Injectable()
export class ChatbotStreamLoopService {
  private readonly logger = new Logger(ChatbotStreamLoopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: ChatbotAiService,
    private readonly toolsService: ChatbotToolsService,
  ) {}

  /**
   * Run the streaming AI loop: stream text, handle tool calls iteratively,
   * and emit SSE events for each phase.
   */
  async runStreamLoop(
    messages: OpenRouterMessage[],
    tools: OpenRouterTool[],
    config: ChatbotConfigMap,
    sessionId: string,
    userId: string,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    let lastToolName: string | undefined;
    let lastActionCard: { type: string; payload: unknown } | undefined;

    for (let i = 0; i < config.max_tool_calls_per_message; i++) {
      const result = await this.consumeStream(
        messages,
        tools,
        config,
        subscriber,
      );

      // No tool calls — final text response
      if (result.toolCalls.length === 0) {
        await this.saveFinalMessage(
          sessionId,
          result.accumulatedText,
          lastToolName,
        );
        this.emit(subscriber, {
          event: 'done',
          intent: classifyIntent(lastToolName),
          toolName: lastToolName,
        });
        return;
      }

      // Process tool calls
      const assistantMsg: OpenRouterMessage = {
        role: 'assistant',
        content: result.accumulatedText || null,
        tool_calls: result.toolCalls,
      };
      messages.push(assistantMsg);

      await this.executeToolCalls(
        result.toolCalls,
        messages,
        sessionId,
        userId,
        subscriber,
      );

      lastToolName = result.toolCalls[result.toolCalls.length - 1].function.name;
      const lastResult = buildActionCard(lastToolName, { success: true });
      if (lastResult) lastActionCard = lastResult;
    }

    // Max tool calls reached — get final streaming response without tools
    await this.streamFinalResponse(
      messages,
      config,
      sessionId,
      lastToolName,
      subscriber,
    );
  }

  // ── Private helpers ──

  private async consumeStream(
    messages: OpenRouterMessage[],
    tools: OpenRouterTool[],
    config: ChatbotConfigMap,
    subscriber: Subscriber<MessageEvent>,
  ) {
    const gen = this.aiService.chatCompletionStream(messages, tools, config);
    let accumulatedText = '';
    let toolCalls: ToolCall[] = [];

    for await (const chunk of gen) {
      if (chunk.type === 'text' && chunk.content) {
        accumulatedText += chunk.content;
        this.emit(subscriber, { event: 'text', content: chunk.content });
      } else if (chunk.type === 'tool_calls' && chunk.toolCalls) {
        toolCalls = chunk.toolCalls;
      }
    }

    return { accumulatedText, toolCalls };
  }

  private async executeToolCalls(
    toolCalls: ToolCall[],
    messages: OpenRouterMessage[],
    sessionId: string,
    userId: string,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    for (const toolCall of toolCalls) {
      const args = JSON.parse(toolCall.function.arguments) as Record<
        string,
        unknown
      >;

      this.emit(subscriber, {
        event: 'tool',
        name: toolCall.function.name,
        status: 'executing',
      });

      const toolResult = await this.toolsService.execute(
        toolCall.function.name,
        args,
        { userId, sessionId },
      );

      const actionCard = buildActionCard(toolCall.function.name, toolResult);
      if (actionCard) {
        this.emit(subscriber, {
          event: 'action',
          type: actionCard.type,
          payload: actionCard.payload,
        });
      }

      this.emit(subscriber, {
        event: 'tool',
        name: toolCall.function.name,
        status: 'done',
      });

      // Persist tool call message
      await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: `[Tool: ${toolCall.function.name}]`,
          functionCall: JSON.parse(
            JSON.stringify({
              name: toolCall.function.name,
              arguments: args,
              result: toolResult,
            }),
          ),
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

  private async streamFinalResponse(
    messages: OpenRouterMessage[],
    config: ChatbotConfigMap,
    sessionId: string,
    lastToolName: string | undefined,
    subscriber: Subscriber<MessageEvent>,
  ): Promise<void> {
    const gen = this.aiService.chatCompletionStream(messages, [], config);
    let finalText = '';

    for await (const chunk of gen) {
      if (chunk.type === 'text' && chunk.content) {
        finalText += chunk.content;
        this.emit(subscriber, { event: 'text', content: chunk.content });
      }
    }

    if (!finalText) {
      finalText = 'I apologize, I encountered an issue. Please try again.';
      this.emit(subscriber, { event: 'text', content: finalText });
    }

    await this.saveFinalMessage(sessionId, finalText, lastToolName);
    this.emit(subscriber, {
      event: 'done',
      intent: classifyIntent(lastToolName),
      toolName: lastToolName,
    });
  }

  private async saveFinalMessage(
    sessionId: string,
    content: string,
    toolName?: string,
  ): Promise<void> {
    await this.prisma.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content,
        intent: classifyIntent(toolName),
        toolName,
      },
    });
  }

  private emit(
    subscriber: Subscriber<MessageEvent>,
    payload: SsePayload,
  ): void {
    subscriber.next({
      data: JSON.stringify(payload),
    } as MessageEvent);
  }
}
