import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GroupSessionsController } from './group-sessions.controller.js';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsEnrollmentsService } from './group-sessions-enrollments.service.js';

@Module({
  imports: [FeatureFlagsModule, NotificationsModule],
  controllers: [GroupSessionsController],
  providers: [GroupSessionsService, GroupSessionsEnrollmentsService],
  exports: [GroupSessionsService, GroupSessionsEnrollmentsService],
})
export class GroupSessionsModule {}
