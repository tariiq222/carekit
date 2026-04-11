import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ChatAdapter } from '../../../infrastructure/ai';
import { SemanticSearchHandler } from '../semantic-search/semantic-search.handler';
import type { ChatCompletionDto, ChatCompletionResult } from './chat-completion.dto';

const SYSTEM_PROMPT_TEMPLATE = (context: string) => `
You are a helpful assistant for a medical clinic using CareKit.
Answer the user's question based ONLY on the following context.
If the context doesn't contain the answer, say you don't have that information.

Context:
${context}
`.trim();

@Injectable()
export class ChatCompletionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SemanticSearchHandler,
    private readonly chat: ChatAdapter,
  ) {}

  async execute(dto: ChatCompletionDto): Promise<ChatCompletionResult> {
    if (!this.chat.isAvailable()) {
      throw new BadRequestException('ChatAdapter is not available — set OPENROUTER_API_KEY');
    }

    const chunks = await this.search.execute({
      tenantId: dto.tenantId,
      query: dto.userMessage,
      topK: 5,
    });

    const context = chunks.map((c) => c.content).join('\n\n');

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT_TEMPLATE(context) },
      { role: 'user' as const, content: dto.userMessage },
    ];

    const reply = await this.chat.complete(messages);

    let sessionId = dto.sessionId;
    if (!sessionId) {
      const session = await this.prisma.chatSession.create({
        data: {
          tenantId: dto.tenantId,
          clientId: dto.clientId,
          userId: dto.userId,
        },
      });
      sessionId = session.id;
    }

    await this.prisma.chatMessage.createMany({
      data: [
        { sessionId, role: 'user', content: dto.userMessage },
        { sessionId, role: 'assistant', content: reply },
      ],
    });

    return { sessionId, reply, sourcesUsed: chunks.length };
  }
}
