import { Controller, Post, Get, Body, UseGuards, Param, Query, ParseUUIDPipe, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { CreateGuestBookingHandler } from '../../modules/bookings/public/create-guest-booking.handler';
import { CreateGuestBookingDto } from '../../modules/bookings/public/create-guest-booking.dto';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ListPublicGroupSessionsHandler } from '../../modules/bookings/public/list-public-group-sessions.handler';
import { GetPublicGroupSessionHandler } from '../../modules/bookings/public/get-public-group-session.handler';
import { BookGroupSessionHandler } from '../../modules/bookings/public/book-group-session.handler';
import type { OtpSessionPayload } from '../../modules/identity/otp/otp-session.service';
import type { Request } from 'express';

@ApiTags('Public / Bookings')
@ApiPublicResponses()
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly createGuestBookingHandler: CreateGuestBookingHandler,
    private readonly listGroupSessions: ListPublicGroupSessionsHandler,
    private readonly getGroupSession: GetPublicGroupSessionHandler,
    private readonly bookGroupSession: BookGroupSessionHandler,
  ) {}

  @Public()
  @Get('group-sessions')
  @ApiOperation({ summary: 'List public group sessions' })
  async listGroupSessionsEndpoint(@Query('branchId') branchId?: string) {
    return this.listGroupSessions.execute(branchId);
  }

  @Public()
  @Get('group-sessions/:id')
  @ApiOperation({ summary: 'Get a public group session' })
  async getGroupSessionEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getGroupSession.execute(id);
  }

  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Post('group-sessions/:id/book')
  @ApiOperation({ summary: 'Book a group session or join waitlist (requires client auth)' })
  async bookGroupSessionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() client: { id: string },
  ) {
    return this.bookGroupSession.execute({
      groupSessionId: id,
      clientId: client.id,
    });
  }

  @Public()
  @UseGuards(OtpSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  @Post()
  @ApiOperation({ summary: 'Create a guest booking (requires OTP session)' })
  async create(
    @Body() dto: CreateGuestBookingDto,
    @Req() req: Request,
  ) {
    const session = (req as Request & { otpSession: OtpSessionPayload }).otpSession;
    return this.createGuestBookingHandler.execute({
      ...dto,
      identifier: session.identifier,
      sessionJti: session.jti,
      sessionExp: session.exp ?? Math.floor(Date.now() / 1000) + 1800,
      sessionChannel: session.channel,
    });
  }
}
