import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { ClientTokenService } from '../shared/client-token.service';
import { PasswordService } from '../shared/password.service';
import { ClientLoginDto } from './client-login.dto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const RATE_LIMIT_WINDOW_SECONDS = 900;

@Injectable()
export class ClientLoginHandler {
  private readonly logger = new Logger(ClientLoginHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly clientTokens: ClientTokenService,
    private readonly passwords: PasswordService,
  ) {}

  async execute(dto: ClientLoginDto) {
    const client = await this.prisma.client.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!client || !client.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (client.lockoutUntil && client.lockoutUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked. Try again later.');
    }

    const rateLimitKey = `client_login:${dto.email}`;
    const redisClient = this.redis.getClient();
    const attempts = await redisClient.incr(rateLimitKey);

    if (attempts === 1) {
      await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (attempts > MAX_LOGIN_ATTEMPTS) {
      await redisClient.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
      throw new UnauthorizedException('Too many failed attempts. Please try again later.');
    }

    const passwordMatch = await this.passwords.verify(dto.password, client.passwordHash);

    if (!passwordMatch) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          loginAttempts: { increment: 1 },
          lockoutUntil: attempts >= MAX_LOGIN_ATTEMPTS - 1
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : undefined,
        },
      });

      const remaining = MAX_LOGIN_ATTEMPTS - attempts;
      throw new UnauthorizedException(
        remaining > 0
          ? `Invalid credentials. ${remaining} attempt(s) remaining.`
          : 'Invalid credentials. Account locked for 15 minutes.',
      );
    }

    if (client.loginAttempts > 0 || client.lockoutUntil) {
      await this.prisma.client.update({
        where: { id: client.id },
        data: { loginAttempts: 0, lockoutUntil: null },
      });
    }

    await this.prisma.client.update({
      where: { id: client.id },
      data: { lastLoginAt: new Date() },
    });

    await redisClient.del(rateLimitKey);

    const tokens = await this.clientTokens.issueTokenPair({
      id: client.id,
      email: client.email,
    });

    this.logger.log(`Client login: ${client.id} (${client.email})`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      clientId: client.id,
    };
  }
}
