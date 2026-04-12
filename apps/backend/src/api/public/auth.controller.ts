import {
  Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { LoginDto } from '../../modules/identity/login/login.dto';
import { RefreshTokenDto } from '../../modules/identity/refresh-token/refresh-token.dto';
import { LogoutDto } from '../../modules/identity/logout/logout.dto';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { TenantId } from '../../common/tenant/tenant.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginHandler,
    private readonly logout: LogoutHandler,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginEndpoint(@TenantId() tenantId: string, @Body() body: LoginDto) {
    return this.login.execute({ tenantId, email: body.email, password: body.password });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshEndpoint(@Body() body: RefreshTokenDto) {
    const { refreshToken: rawToken } = body;
    const record = await this.findActiveToken(rawToken);

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
      include: { customRole: { include: { permissions: true } } },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    return this.tokens.issueTokenPair(user);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logoutEndpoint(@Body() body: LogoutDto) {
    const { refreshToken: rawToken } = body;
    const record = await this.findActiveToken(rawToken);
    await this.logout.execute({ userId: record.userId, tenantId: record.tenantId });
  }

  // Uses tokenSelector (first 8 chars of the raw UUID) as an indexed DB filter
  // so the bcrypt.compare runs on at most a handful of rows, not the full table.
  private async findActiveToken(rawToken: string) {
    const selector = rawToken.slice(0, 8);

    const candidates = await this.prisma.refreshToken.findMany({
      where: { tokenSelector: selector, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    for (const c of candidates) {
      if (await bcrypt.compare(rawToken, c.tokenHash)) return c;
    }

    throw new UnauthorizedException('Invalid or expired refresh token');
  }
}
