import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { ZoomService } from './zoom.service.js';

@Module({
  controllers: [BookingsController],
  providers: [
    BookingsService,
    { provide: 'ZoomService', useClass: ZoomService },
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
