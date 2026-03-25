import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { buildSystemPrompt } from './constants/system-prompts.js';
import { buildToolDefinitions } from './constants/tool-definitions.js';
import type {
  OpenRouterMessage,
  OpenRouterTool,
} from './interfaces/chatbot-tool.interface.js';
import type { ChatbotConfigMap } from './interfaces/chatbot-config.interface.js';

export interface AiContext {
  messages: OpenRouterMessage[];
  tools: OpenRouterTool[];
}

@Injectable()
export class ChatbotContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ChatbotConfigService,
  ) {}

  /**
   * Builds the full AI context for a chat message.
   * Fetches patient name, clinic name, system prompt, tools, and history.
   */
  async buildAiContext(
    sessionId: string,
    userId: string,
    content: string,
    config: ChatbotConfigMap,
  ): Promise<AiContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const patientName = user
      ? `${user.firstName} ${user.lastName}`
      : 'Patient';

    const clinicConfig = await this.prisma.whiteLabelConfig.findFirst({
      where: { key: 'clinic_name' },
    });
    const clinicName = clinicConfig?.value ?? 'CareKit Clinic';

    const systemPrompt = buildSystemPrompt(config, {
      clinicName,
      patientName,
      today: new Date().toISOString().split('T')[0],
    });

    const tools = buildToolDefinitions(config);
    const history = await this.loadHistory(
      sessionId,
      config.context_window_size,
    );

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content },
    ];

    return { messages, tools };
  }

  /**
   * Loads recent chat history for a session within the configured window size.
   * Includes tool messages so the AI has full tool-call context on resumption.
   */
  async loadHistory(
    sessionId: string,
    windowSize: number,
  ): Promise<OpenRouterMessage[]> {
    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId, role: { in: ['user', 'assistant', 'tool'] as any[] } },
      orderBy: { createdAt: 'desc' },
      take: windowSize,
    });

    return messages.reverse().map((m) => {
      if ((m.role as string) === 'tool') {
        const fc = m.functionCall as { tool_call_id?: string } | null;
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: fc?.tool_call_id ?? 'unknown',
        };
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });
  }
}
