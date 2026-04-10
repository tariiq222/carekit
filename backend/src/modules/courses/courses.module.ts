import { Module } from '@nestjs/common';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { CoursesEnrollmentsService } from './courses-enrollments.service.js';

@Module({
  imports: [FeatureFlagsModule, NotificationsModule],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesEnrollmentsService],
  exports: [CoursesService, CoursesEnrollmentsService],
})
export class CoursesModule {}
