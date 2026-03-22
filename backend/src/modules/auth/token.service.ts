import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { UserPayload } from './types/user-payload.type.js';
import { TokenPair } from './types/auth-response.type.js';

const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

  async storeRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt },
    });
  }

  async refreshToken(token: string): Promise<TokenPair> {
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token },
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid refresh token',
        error: 'AUTH_REFRESH_TOKEN_INVALID',
      });
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Refresh token has expired',
        error: 'AUTH_REFRESH_TOKEN_EXPIRED',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Account is deactivated',
        error: 'AUTH_REFRESH_TOKEN_INVALID',
      });
    }

    // Rotate: delete old, generate new
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
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

    return this.buildUserPayload(user);
  }
}
