import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { CreateGuestBookingHandler } from '../../modules/bookings/public/create-guest-booking.handler';
import { CreateGuestBookingDto } from '../../modules/bookings/public/create-guest-booking.dto';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';
import type { Request } from 'express';
import type { OtpSessionPayload } from '../../modules/identity/otp/otp-session.service';

@ApiTags('Public / Bookings')
@ApiPublicResponses()
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(private readonly createGuestBookingHandler: CreateGuestBookingHandler) {}

  @Public()
  @UseGuards(OtpSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  @Post()
  @ApiOperation({ summary: 'Create a guest booking (requires OTP session)' })
  async create(@Body() dto: CreateGuestBookingDto, @Req() req: Request) {
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
