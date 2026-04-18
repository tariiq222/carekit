import { Controller, Post, Body, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { RegisterHandler } from '../../modules/identity/client-auth/register.handler';
import { RegisterDto } from '../../modules/identity/client-auth/register.dto';
import { ClientLoginHandler } from '../../modules/identity/client-auth/client-login.handler';
import { ClientLoginDto } from '../../modules/identity/client-auth/client-login.dto';
import { ClientRefreshHandler } from '../../modules/identity/client-auth/client-refresh.handler';
import { ClientLogoutHandler } from '../../modules/identity/client-auth/client-logout.handler';
import { RefreshTokenDto, LogoutDto } from '../../modules/identity/client-auth/client-tokens.dto';
import { Request } from 'express';

@ApiTags('Public / Auth')
@ApiPublicResponses()
@Controller('public/auth')
export class PublicAuthController {
  constructor(
    private readonly register: RegisterHandler,
    private readonly login: ClientLoginHandler,
    private readonly refresh: ClientRefreshHandler,
    private readonly logout: ClientLogoutHandler,
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

  @UseGuards(ClientSessionGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a client refresh token and issue new token pair' })
  async refreshEndpoint(
    @Body() dto: RefreshTokenDto,
    @ClientSession() session: { id: string },
  ) {
    return this.refresh.execute(dto.refreshToken, session.id);
  }

  @UseGuards(ClientSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  @ApiOperation({ summary: 'Revoke a client refresh token (log out)' })
  async logoutEndpoint(
    @Body() dto: LogoutDto,
    @ClientSession() session: { id: string },
  ) {
    await this.logout.execute(dto.refreshToken, session.id);
  }
}
