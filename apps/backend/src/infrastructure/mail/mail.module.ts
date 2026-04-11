import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { SmtpService } from './smtp.service';

@Global()
@Module({
  providers: [FcmService, SmtpService],
  exports: [FcmService, SmtpService],
})
export class MailModule {}
