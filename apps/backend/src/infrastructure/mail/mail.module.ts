import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { SmtpService } from './smtp.service';
import { PlatformMailerService } from './platform-mailer.service';
import { PlatformSettingsModule } from '../../modules/platform/settings/platform-settings.module';

@Global()
@Module({
  imports: [PlatformSettingsModule],
  providers: [FcmService, SmtpService, PlatformMailerService],
  exports: [FcmService, SmtpService, PlatformMailerService],
})
export class MailModule {}
