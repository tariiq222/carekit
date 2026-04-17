import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { RequestOtpHandler } from '../../modules/identity/otp/request-otp.handler';
import { RequestOtpDto } from '../../modules/identity/otp/request-otp.dto';

@ApiTags('Public / OTP')
@ApiPublicResponses()
@Controller('public/otp')
export class PublicOtpController {
  constructor(private readonly requestHandler: RequestOtpHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('request')
  @ApiOperation({ summary: 'Request an OTP code' })
  async request(@Body() dto: RequestOtpDto) {
    return this.requestHandler.execute(dto);
  }
}
