import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module.js';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { GroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';
import { GroupsPaymentService } from './groups-payment.service.js';
import { GroupsLifecycleService } from './groups-lifecycle.service.js';
import { GroupsEnrollmentsService } from './groups-enrollments.service.js';
import { GroupsAttendanceService } from './groups-attendance.service.js';

@Module({
  imports: [ActivityLogModule, FeatureFlagsModule, NotificationsModule],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    GroupsPaymentService,
    GroupsLifecycleService,
    GroupsEnrollmentsService,
    GroupsAttendanceService,
  ],
  exports: [GroupsService, GroupsEnrollmentsService, GroupsPaymentService],
})
export class GroupsModule {}
