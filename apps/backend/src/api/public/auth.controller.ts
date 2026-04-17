import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { LoginDto } from '../../modules/identity/login/login.dto';
import { RefreshTokenDto } from '../../modules/identity/refresh-token/refresh-token.dto';
import { LogoutDto } from '../../modules/identity/logout/logout.dto';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { UserId } from '../../common/auth/user-id.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { GetCurrentUserQuery } from '../../modules/identity/get-current-user/get-current-user.query';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPublicResponses, ApiErrorDto } from '../../common/swagger';
import { flattenPermissions } from '../../modules/identity/casl/flatten-permissions';

class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password', example: 'P@ssw0rd123' })
  @IsString() currentPassword!: string;

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'NewP@ss456', format: 'password' })
  @IsString() @MinLength(8) newPassword!: string;
}

@ApiTags('Public / Auth')
@ApiPublicResponses()
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
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({
    description: 'Access + refresh tokens with user profile',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'a1b2c3d4-...' },
        expiresIn: { type: 'number', example: 900 },
        user: { type: 'object', description: 'Authenticated user profile' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials', type: ApiErrorDto })
  async loginEndpoint(@Body() body: LoginDto) {
    const tokens = await this.login.execute({ email: body.email, password: body.password });
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      omit: { passwordHash: true },
      include: { customRole: { include: { permissions: true } } },
    });
    return {
      ...tokens,
      user: user ? { ...user, permissions: flattenPermissions(user) } : user,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token and issue new token pair' })
  @ApiOkResponse({
    description: 'New access + refresh token pair',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refreshToken: { type: 'string', example: 'a1b2c3d4-...' },
        expiresIn: { type: 'number', example: 900 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token', type: ApiErrorDto })
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
  @ApiOperation({ summary: 'Revoke a refresh token (log out)' })
  @ApiOkResponse({ description: 'Token revoked; no body returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token', type: ApiErrorDto })
  async logoutEndpoint(@Body() body: LogoutDto) {
    const { refreshToken: rawToken } = body;
    const record = await this.findActiveToken(rawToken);
    await this.logout.execute({ userId: record.userId });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  @ApiOkResponse({ description: 'Current user profile with role and permissions' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT', type: ApiErrorDto })
  async meEndpoint(@UserId() userId: string) {
    const user = await this.getCurrentUser.execute({ userId } satisfies GetCurrentUserQuery);
    return { ...user, permissions: flattenPermissions(user) };
  }

  @Patch('password/change')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user\'s password' })
  @ApiNoContentResponse({ description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Missing/invalid JWT or wrong current password', type: ApiErrorDto })
  async changePasswordEndpoint(
    @UserId() userId: string,
    @Body() body: ChangePasswordDto,
  ) {
    await this.changePassword.execute({
      userId,
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
