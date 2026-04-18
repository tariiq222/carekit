import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { RegisterHandler } from '../../modules/identity/client-auth/register.handler';
import { RegisterDto } from '../../modules/identity/client-auth/register.dto';
import { ClientLoginHandler } from '../../modules/identity/client-auth/client-login.handler';
import { ClientLoginDto } from '../../modules/identity/client-auth/client-login.dto';
import { Request } from 'express';

@ApiTags('Public / Auth')
@ApiPublicResponses()
@Controller('public/auth')
export class PublicAuthController {
  constructor(
    private readonly register: RegisterHandler,
    private readonly login: ClientLoginHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register a client account via verified OTP session' })
  async registerEndpoint(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.register.execute(dto, req);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  async loginEndpoint(@Body() dto: ClientLoginDto) {
    return this.login.execute(dto);
  }
}
