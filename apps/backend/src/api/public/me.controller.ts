import { Controller, Get, Patch, Query, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { ListClientBookingsHandler } from '../../modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientCancelBookingDto } from '../../modules/bookings/client/client-cancel-booking.dto';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../modules/bookings/client/client-reschedule-booking.dto';

@ApiTags('Public / Me')
@ApiBearerAuth()
@UseGuards(ClientSessionGuard)
@Controller('public/me')
export class PublicMeController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly listBookings: ListClientBookingsHandler,
    private readonly cancelBooking: ClientCancelBookingHandler,
    private readonly rescheduleBooking: ClientRescheduleBookingHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated client profile' })
  async meEndpoint(@ClientSession() session: { id: string }) {
    return this.getMe.execute(session.id);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List bookings for the authenticated client' })
  async bookingsEndpoint(
    @ClientSession() session: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listBookings.execute(
      session.id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a booking (client self-serve)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  async cancelBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientCancelBookingDto,
  ) {
    return this.cancelBooking.execute({ bookingId: id, clientId: session.id, ...body });
  }

  @Patch('bookings/:id/reschedule')
  @ApiOperation({ summary: 'Reschedule a booking (client self-serve)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  async rescheduleBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRescheduleBookingDto,
  ) {
    const { newScheduledAt, newDurationMins } = body;
    return this.rescheduleBooking.execute({
      bookingId: id,
      clientId: session.id,
      newScheduledAt,
      newDurationMins,
    });
  }
}
