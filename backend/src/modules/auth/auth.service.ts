import {
  ConflictException,
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { SALT_ROUNDS } from '../../config/constants.js';
import { RegisterDto } from './dto/register.dto.js';
import { OtpType } from './enums/otp-type.enum.js';
import { UserPayload } from '../../common/types/user-payload.type.js';
import { AuthResponse, TokenPair } from './types/auth-response.type.js';
import { TokenService } from './token.service.js';
import { OtpService } from './otp.service.js';
import { EmailService } from '../email/email.service.js';
import { AuthCacheService } from './auth-cache.service.js';
import { PermissionCacheService } from './permission-cache.service.js';
import { PatientWalkInService } from '../patients/patient-walk-in.service.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly authCache: AuthCacheService,
    private readonly permissionCache: PermissionCacheService,
    private readonly walkInService: PatientWalkInService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    // فحص الايميل أولاً
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A user with this email already exists',
        error: 'USER_EMAIL_EXISTS',
      });
    }

    // إذا أرسل المريض جواله، نتحقق هل يوجد حساب WALK_IN بهذا الجوال
    if (dto.phone) {
      const walkInUser = await this.walkInService.findWalkInByPhone(dto.phone);
      if (walkInUser) {
        if (walkInUser.accountType === AccountType.walk_in) {
          // auto-claim: نحوّل الحساب الموجود لحساب كامل
          const claimed = await this.walkInService.claimAccount({
            phone: dto.phone,
            email,
            password: dto.password,
          });
          const tokens = await this.tokenService.generateTokens(claimed.id, claimed.email);
          await this.tokenService.storeRefreshToken(claimed.id, tokens.refreshToken);
          await this.emailService.sendWelcome(claimed.email, claimed.firstName);
          const fullUser = await this.tokenService.buildUserPayloadFromId(claimed.id);
          return { user: fullUser, ...tokens };
        }
        // حساب FULL بنفس الجوال — خطأ
        throw new ConflictException({
          statusCode: 409,
          message: 'A patient with this phone number already has an account',
          error: 'PATIENT_PHONE_EXISTS',
        });
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const patientRole = await this.prisma.role.findFirst({
      where: { slug: 'patient', isDefault: true },
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
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
        await tx.userRole.create({
          data: { userId: created.id, roleId: patientRole.id },
        });
      }

      return created;
    });

    const tokens = await this.tokenService.generateTokens(user.id, user.email);
    await this.tokenService.storeRefreshToken(user.id, tokens.refreshToken);

    await this.emailService.sendWelcome(user.email, user.firstName);

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

    // Invalidate all sessions: revoke refresh tokens + clear auth/permission caches
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.authCache.invalidate(userId);
    await this.permissionCache.invalidate(userId);
  }

  async getUserProfile(userId: string): Promise<UserPayload> {
    return this.tokenService.buildUserPayloadFromId(userId);
  }

  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
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

  // --- Delegated: Email ---

  async sendOtpEmail(
    email: string,
    code: string,
    type: 'login' | 'reset_password' | 'verify_email',
  ): Promise<void> {
    await this.emailService.sendOtp(email, code, type);
  }

  // --- Delegated: Token ---

  async refreshToken(token: string): Promise<TokenPair> {
    return this.tokenService.refreshToken(token);
  }
}
