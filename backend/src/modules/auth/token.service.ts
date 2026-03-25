import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthCacheService } from './auth-cache.service.js';
import { UserPayload } from '../../common/types/user-payload.type.js';
import { TokenPair } from './types/auth-response.type.js';

const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authCache: AuthCacheService,
  ) {}

  async generateTokens(userId: string, email: string): Promise<TokenPair> {
    const accessPayload = { sub: userId, email, jti: crypto.randomUUID() };
    const refreshPayload = { sub: userId, email, jti: crypto.randomUUID() };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: 900,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: 604800, // 7 days
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, token: this.hashToken(token), expiresAt },
    });
  }

  async refreshToken(token: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(token);

    // Atomic token rotation inside a serializable transaction:
    // 1) Find the token record (includes userId + expiry)
    // 2) Delete it atomically — concurrent request gets count=0 on its deleteMany
    // 3) Issue new token pair and store it — all in one transaction
    //
    // Token theft detection: if a token that was already rotated is presented again,
    // we decode the JWT to extract userId and revoke ALL tokens for that user
    // (token family invalidation).
    return this.prisma.$transaction(async (tx) => {
      const storedToken = await tx.refreshToken.findFirst({
        where: { token: tokenHash },
      });

      if (!storedToken) {
        // Token not found in DB. Decode JWT to check if this userId had tokens — if
        // the JWT is structurally valid, it may be a reused/rotated token (theft).
        const decoded = this.jwtService.decode(token) as { sub?: string } | null;
        if (decoded?.sub) {
          // Revoke all tokens for this user as a compromise response
          await tx.refreshToken.deleteMany({ where: { userId: decoded.sub } });
          await this.authCache.invalidate(decoded.sub);
        }
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Invalid refresh token',
          error: 'AUTH_REFRESH_TOKEN_INVALID',
        });
      }

      if (storedToken.expiresAt < new Date()) {
        await tx.refreshToken.delete({ where: { id: storedToken.id } });
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Refresh token has expired',
          error: 'AUTH_REFRESH_TOKEN_EXPIRED',
        });
      }

      const user = await tx.user.findUnique({ where: { id: storedToken.userId } });
      if (!user || !user.isActive) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'Account is deactivated',
          error: 'AUTH_REFRESH_TOKEN_INVALID',
        });
      }

      // Rotate: delete old token atomically within the same transaction
      await tx.refreshToken.delete({ where: { id: storedToken.id } });

      // Generate new token pair
      const tokens = await this.generateTokens(user.id, user.email);

      // Store new refresh token within the same transaction
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.refreshToken.create({
        data: { userId: user.id, token: this.hashToken(tokens.refreshToken), expiresAt: newExpiresAt },
      });

      return tokens;
    }, { isolationLevel: 'Serializable' });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token: this.hashToken(token) } });
  }

  buildUserPayload(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    gender?: string | null;
    isActive: boolean;
    emailVerified: boolean;
    createdAt: Date;
    userRoles?: Array<{
      role: {
        id?: string;
        name?: string;
        slug: string;
        rolePermissions?: Array<{
          permission: { module: string; action: string };
        }>;
      };
    }>;
  }): UserPayload {
    const userRoles = user.userRoles ?? [];

    const roles = userRoles.map((ur) => ({
      id: ur.role.id ?? '',
      name: ur.role.name ?? ur.role.slug,
      slug: ur.role.slug,
    }));

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      const rolePerms = ur.role.rolePermissions ?? [];
      for (const rp of rolePerms) {
        permissionSet.add(`${rp.permission.module}:${rp.permission.action}`);
      }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? null,
      gender: user.gender ?? null,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      roles,
      permissions: Array.from(permissionSet),
    };
  }

  async buildUserPayloadFromId(userId: string): Promise<UserPayload> {
    // Check Redis cache first
    const cached = await this.authCache.get(userId);
    if (cached) return cached;

    // M6: Acquire lock to prevent cache stampede (thundering herd).
    // Only one request populates the cache; others wait briefly then re-check.
    const lockAcquired = await this.authCache.acquirePopulateLock(userId);
    if (!lockAcquired) {
      // Another request is populating — wait briefly and return from cache
      await new Promise((resolve) => setTimeout(resolve, 50));
      const cached2 = await this.authCache.get(userId);
      if (cached2) return cached2;
      // Still not cached — fall through and fetch directly (lock may have expired)
    }

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException({
          statusCode: 401,
          message: 'User not found',
          error: 'AUTH_TOKEN_INVALID',
        });
      }

      const payload = this.buildUserPayload(user);
      await this.authCache.set(userId, payload);
      return payload;
    } finally {
      if (lockAcquired) {
        await this.authCache.releasePopulateLock(userId);
      }
    }
  }
}
