import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { SmtpService } from './smtp.service';
import { PlatformMailerService } from './platform-mailer.service';

@Global()
@Module({
  providers: [FcmService, SmtpService, PlatformMailerService],
  exports: [FcmService, SmtpService, PlatformMailerService],
})
export class MailModule {}
