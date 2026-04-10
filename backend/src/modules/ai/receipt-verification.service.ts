import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';

interface OpenRouterChoice {
  message: {
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

interface AiReceiptResult {
  extractedAmount: number | null;
  extractedDate: string | null;
  confidence: number;
  status:
    | 'matched'
    | 'amount_differs'
    | 'suspicious'
    | 'old_date'
    | 'unreadable';
  notes: string;
}

@Injectable()
export class ReceiptVerificationService {
  private readonly logger = new Logger(ReceiptVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async verifyReceipt(receiptId: string): Promise<void> {
    // 1. Find the receipt by id (include payment with booking)
    const receipt = await this.prisma.bankTransferReceipt.findUnique({
      where: { id: receiptId },
      include: {
        payment: {
          include: {
            booking: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Receipt not found',
        error: 'NOT_FOUND',
      });
    }

    // 2. Skip if already processed
    if (receipt.aiVerificationStatus !== 'pending') {
      this.logger.log(
        `Receipt ${receiptId} already processed with status: ${receipt.aiVerificationStatus}`,
      );
      return;
    }

    const payment = receipt.payment;
    const expectedAmount = payment.totalAmount;
    const expectedAmountSar = expectedAmount / 100;

    const prompt =
      `Analyze this bank transfer receipt. Extract: 1) Transfer amount in SAR (as integer halalat = amount * 100), 2) Transfer date (ISO string). ` +
      `Compare with expected amount: ${expectedAmount} halalat (= ${expectedAmountSar} SAR). ` +
      `Respond ONLY with JSON: { "extractedAmount": <integer halalat or null>, "extractedDate": "<ISO date string or null>", "confidence": <0.0-1.0>, "status": "<matched|amount_differs|suspicious|old_date|unreadable>", "notes": "<brief reason>" }. ` +
      `Status rules: 'matched' if amount within 5% of expected; 'amount_differs' if amount found but doesn't match; 'old_date' if date is more than 7 days ago; 'suspicious' if something looks wrong; 'unreadable' if can't read the receipt.`;

    try {
      // 3. Call OpenRouter API with vision model
      const apiKey = this.config.get<string>('OPENROUTER_API_KEY');

      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'carekit',
            'X-Title': 'CareKit',
          },
          body: JSON.stringify({
            model: 'google/gemini-flash-1.5',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: receipt.receiptUrl },
                  },
                  {
                    type: 'text',
                    text: prompt,
                  },
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenRouter API error: ${response.status} ${response.statusText} — ${errorText}`,
        );
      }

      const openRouterData = (await response.json()) as OpenRouterResponse;
      const rawContent = openRouterData.choices[0].message.content;

      // 4. Parse the JSON response from the LLM
      let parsed: AiReceiptResult;
      try {
        // Strip markdown code fences if present
        const jsonString = rawContent
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        parsed = JSON.parse(jsonString) as AiReceiptResult;
      } catch {
        throw new Error(
          `Failed to parse AI response as JSON. Raw content: ${rawContent}`,
        );
      }

      // 5. Update the BankTransferReceipt
      await this.prisma.bankTransferReceipt.update({
        where: { id: receiptId },
        data: {
          aiVerificationStatus: parsed.status,
          aiConfidence: parsed.confidence,
          aiNotes: parsed.notes,
          extractedAmount: parsed.extractedAmount ?? undefined,
          extractedDate: parsed.extractedDate
            ? new Date(parsed.extractedDate)
            : undefined,
        },
      });

      this.logger.log(
        `Receipt ${receiptId} verified with status: ${parsed.status}, confidence: ${parsed.confidence}`,
      );
    } catch (error: unknown) {
      // 6. On any error: set status to 'unreadable'
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Receipt verification failed for ${receiptId}: ${errorMessage}`,
      );

      await this.prisma.bankTransferReceipt.update({
        where: { id: receiptId },
        data: {
          aiVerificationStatus: 'unreadable',
          aiNotes: errorMessage,
        },
      });
    }
  }
}
