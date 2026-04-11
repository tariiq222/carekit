import { Injectable, Logger } from '@nestjs/common';
import type { SendSmsDto } from './send-sms.dto';

@Injectable()
export class SendSmsHandler {
  private readonly logger = new Logger(SendSmsHandler.name);

  async execute(dto: SendSmsDto): Promise<void> {
    this.logger.log(`[SMS STUB] To: ${dto.phone} | Body: ${dto.body}`);
  }
}
