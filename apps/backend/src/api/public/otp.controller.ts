import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { RequestOtpHandler } from '../../modules/identity/otp/request-otp.handler';
import { VerifyOtpHandler } from '../../modules/identity/otp/verify-otp.handler';
import { RequestOtpDto } from '../../modules/identity/otp/request-otp.dto';
import { VerifyOtpDto } from '../../modules/identity/otp/verify-otp.dto';

@ApiTags('Public / OTP')
@ApiPublicResponses()
@Controller('public/otp')
export class PublicOtpController {
  constructor(
    private readonly requestHandler: RequestOtpHandler,
    private readonly verifyHandler: VerifyOtpHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('request')
  @ApiOperation({ summary: 'Request an OTP code' })
  async request(@Body() dto: RequestOtpDto) {
    return this.requestHandler.execute(dto);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('verify')
  @ApiOperation({ summary: 'Verify an OTP code and receive a session token' })
  async verify(@Body() dto: VerifyOtpDto) {
    return this.verifyHandler.execute(dto);
  }
}
