import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { LoginDto } from '../../modules/identity/login/login.dto';
import { RefreshTokenDto } from '../../modules/identity/refresh-token/refresh-token.dto';
import { LogoutDto } from '../../modules/identity/logout/logout.dto';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { TenantId, UserId } from '../../common/tenant/tenant.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { GetCurrentUserQuery } from '../../modules/identity/get-current-user/get-current-user.query';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { IsString, MinLength } from 'class-validator';

class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginHandler,
    private readonly logout: LogoutHandler,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly getCurrentUser: GetCurrentUserHandler,
    private readonly changePassword: ChangePasswordHandler,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginEndpoint(@TenantId() tenantId: string, @Body() body: LoginDto) {
    const tokens = await this.login.execute({ tenantId, email: body.email, password: body.password });
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: body.email } },
      omit: { passwordHash: true },
      include: { customRole: { include: { permissions: true } } },
    });
    return {
      ...tokens,
      user,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
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

    const tokens = await this.tokens.issueTokenPair(user);
    return {
      ...tokens,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logoutEndpoint(@Body() body: LogoutDto) {
    const { refreshToken: rawToken } = body;
    const record = await this.findActiveToken(rawToken);
    await this.logout.execute({ userId: record.userId, tenantId: record.tenantId });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  async meEndpoint(
    @UserId() userId: string,
    @TenantId() tenantId: string,
  ) {
    return this.getCurrentUser.execute({ userId, tenantId } satisfies GetCurrentUserQuery);
  }

  @Patch('password/change')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePasswordEndpoint(
    @UserId() userId: string,
    @TenantId() tenantId: string,
    @Body() body: ChangePasswordDto,
  ) {
    await this.changePassword.execute({
      userId,
      tenantId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  private parseTtlSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const n = parseInt(match[1], 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return n * multipliers[match[2]];
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
