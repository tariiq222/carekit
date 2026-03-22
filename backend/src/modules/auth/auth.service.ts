import {
  ConflictException,
  Inject,
  Injectable,
  Optional,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { OtpType } from './enums/otp-type.enum.js';
import { UserPayload } from './types/user-payload.type.js';
import { AuthResponse, TokenPair } from './types/auth-response.type.js';
import { TokenService } from './token.service.js';
import { OtpService } from './otp.service.js';

interface MailQueue {
  add(name: string, data: Record<string, unknown>): Promise<unknown>;
}

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    @Optional() @Inject('BullQueue_email') private readonly mailQueue?: MailQueue,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A user with this email already exists',
        error: 'USER_EMAIL_EXISTS',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const patientRole = await this.prisma.role.findFirst({
      where: { slug: 'patient', isDefault: true },
    });

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        gender: dto.gender,
      },
    });

    if (patientRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: patientRole.id },
      });
    }

    const tokens = await this.tokenService.generateTokens(user.id, user.email);
    await this.tokenService.storeRefreshToken(user.id, tokens.refreshToken);

    if (this.mailQueue) {
      await this.mailQueue.add('verification', {
        email: user.email,
        firstName: user.firstName,
      });
    }

    const roleInfo = patientRole as { id: string; slug: string; name?: string } | null;
    const userPayload: UserPayload = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      gender: user.gender,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      roles: roleInfo
        ? [{ id: roleInfo.id, name: roleInfo.name ?? roleInfo.slug, slug: roleInfo.slug }]
        : [],
      permissions: [],
    };

    return { user: userPayload, ...tokens };
  }

  async validateUser(email: string, password: string): Promise<UserPayload | null> {
    const normalizedEmail = email.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });

    if (!user || !user.passwordHash) return null;
    if (user.deletedAt) return null;

    if (!user.isActive) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Account has been deactivated',
        error: 'AUTH_ACCOUNT_DEACTIVATED',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return null;

    return this.tokenService.buildUserPayload(user);
  }

  async login(userPayload: UserPayload): Promise<AuthResponse> {
    const tokens = await this.tokenService.generateTokens(userPayload.id, userPayload.email);
    await this.tokenService.storeRefreshToken(userPayload.id, tokens.refreshToken);
    return { user: userPayload, ...tokens };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokenService.deleteRefreshToken(refreshToken);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.passwordHash) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Invalid credentials',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Current password is incorrect',
        error: 'AUTH_INVALID_CREDENTIALS',
      });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });
  }

  async getUserProfile(userId: string): Promise<UserPayload> {
    return this.tokenService.buildUserPayloadFromId(userId);
  }

  // --- Delegated: OTP ---

  async generateOtp(userId: string, type: OtpType | string): Promise<string> {
    return this.otpService.generateOtp(userId, type);
  }

  async verifyOtp(email: string, code: string, type: OtpType | string): Promise<UserPayload> {
    return this.otpService.verifyOtp(email, code, type);
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    return this.otpService.resetPassword(email, code, newPassword);
  }

  async verifyEmail(userId: string, code: string): Promise<void> {
    return this.otpService.verifyEmail(userId, code);
  }

  // --- Delegated: Token ---

  async refreshToken(token: string): Promise<TokenPair> {
    return this.tokenService.refreshToken(token);
  }
}
