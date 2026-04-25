import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
import { DEFAULT_ORGANIZATION_ID } from '../../common/tenant';
import { UserId } from '../../common/auth/user-id.decorator';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { GetCurrentUserQuery } from '../../modules/identity/get-current-user/get-current-user.query';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { ListMembershipsHandler } from '../../modules/identity/list-memberships/list-memberships.handler';
import { SwitchOrganizationHandler } from '../../modules/identity/switch-organization/switch-organization.handler';
import { SwitchOrganizationDto } from '../../modules/identity/switch-organization/switch-organization.dto';
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPublicResponses, ApiErrorDto } from '../../common/swagger';
import { flattenPermissions } from '../../modules/identity/casl/flatten-permissions';
import { Inject, BadRequestException } from '@nestjs/common';
import { CAPTCHA_VERIFIER, CaptchaVerifier } from '../../modules/comms/contact-messages/captcha.verifier';

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
    private readonly listMemberships: ListMembershipsHandler,
    private readonly switchOrganization: SwitchOrganizationHandler,
    private readonly config: ConfigService,
    @Inject(CAPTCHA_VERIFIER) private readonly captcha: CaptchaVerifier,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
    if (!(await this.captcha.verify(body.hCaptchaToken))) {
      throw new BadRequestException('Invalid captcha token');
    }

    const tokens = await this.login.execute({ email: body.email, password: body.password });
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        gender: true,
        avatarUrl: true,
        isActive: true,
        role: true,
        customRoleId: true,
        customRole: { include: { permissions: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return {
        ...tokens,
        user,
        expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
      };
    }

    // SaaS-04 alignment: surface the active membership's organizationId on
    // the login response so mobile/dashboard consumers don't need to decode
    // the JWT to find their tenant. Mirrors LoginHandler's resolution order.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { organizationId: true },
    });

    // Match GetCurrentUserHandler: derive firstName/lastName from `name`
    // by splitting on the first whitespace run.
    const [firstName = '', ...rest] = (user.name ?? '').trim().split(/\s+/);

    return {
      ...tokens,
      user: {
        ...user,
        firstName,
        lastName: rest.join(' '),
        isSuperAdmin: user.role === 'SUPER_ADMIN',
        organizationId: membership?.organizationId ?? null,
        permissions: flattenPermissions(user),
      },
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
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

    const tokens = await this.tokens.issueTokenPair(user, {
      organizationId: record.organizationId ?? DEFAULT_ORGANIZATION_ID,
      isSuperAdmin: user.role === 'SUPER_ADMIN',
    });
    return {
      ...tokens,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Post('logout')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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

  @Get('memberships')
  @UseGuards(JwtGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List organizations the current user belongs to',
    description:
      'SaaS-06 — powers the tenant switcher. Returns one row per ACTIVE ' +
      'membership for the caller, with the organization summary attached.',
  })
  @ApiOkResponse({ description: 'Array of MembershipSummary rows' })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT', type: ApiErrorDto })
  async membershipsEndpoint(@UserId() userId: string) {
    return this.listMemberships.execute({ userId });
  }

  @Post('switch-org')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Switch active organization context',
    description:
      'SaaS-06 — issues a fresh access + refresh token pair scoped to the ' +
      'target organization. Caller must have an ACTIVE membership in the target.',
  })
  @ApiOkResponse({
    description: 'New access + refresh token pair scoped to the target org',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
        expiresIn: { type: 'number', example: 900 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid JWT', type: ApiErrorDto })
  @ApiResponse({
    status: 403,
    description: 'Caller has no active membership in the target organization',
    type: ApiErrorDto,
  })
  async switchOrgEndpoint(
    @UserId() userId: string,
    @Body() body: SwitchOrganizationDto,
  ) {
    const tokens = await this.switchOrganization.execute({
      userId,
      targetOrganizationId: body.organizationId,
    });
    return {
      ...tokens,
      expiresIn: this.parseTtlSeconds(this.config.get<string>('JWT_ACCESS_TTL') ?? '15m'),
    };
  }

  @Patch('password/change')
  @UseGuards(JwtGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
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
