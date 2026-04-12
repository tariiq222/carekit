import { Injectable, Logger } from '@nestjs/common';
import { SendSmsDto } from './send-sms.dto';

@Injectable()
export class SendSmsHandler {
  private readonly logger = new Logger(SendSmsHandler.name);

  async execute(dto: SendSmsDto): Promise<void> {
    this.logger.warn(
      `SMS not sent — stub mode, no provider configured. Would send to ${dto.phone}: ${dto.body}`,
    );
  }
}
