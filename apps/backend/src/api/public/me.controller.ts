import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { ListClientBookingsHandler } from '../../modules/bookings/client/list-client-bookings.handler';

@ApiTags('Public / Me')
@ApiBearerAuth()
@UseGuards(ClientSessionGuard)
@Controller('public/me')
export class PublicMeController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly listBookings: ListClientBookingsHandler,
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
}
